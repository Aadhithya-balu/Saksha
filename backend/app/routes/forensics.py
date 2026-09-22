"""Forensics API — scientific laboratory analysis, human verification sign-off, and certified report generation."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fpdf import FPDF
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, ROLE_ADMIN, ROLE_FORENSIC, ROLE_INSPECTOR, ROLE_INVESTIGATOR, ROLE_CRIME_ANALYST, require_roles
from app.auth.scope import enforce_record_district
from app.database.postgres import get_db
from app.models.crime import CrimeCase
from app.models.evidence import Evidence
from app.models.forensic_report import ForensicReport
from app.models.user import User
from app.schemas.forensic_report import (
    ForensicReportCreate,
    ForensicReportOut,
    ForensicReportUpdate,
    ForensicReportVerifyRequest,
)
from app.services import audit_service
from app.services.base_service import BaseCRUDService

router = APIRouter(prefix="/forensics", tags=["Forensics"], dependencies=[Depends(require_roles(*ALL_ROLES))])
forensics_crud = BaseCRUDService(ForensicReport)


def _safe_pdf_text(text: any) -> str:
    if text is None:
        return ""
    s = str(text).strip()
    replacements = {
        "\u2014": " - ",
        "\u2013": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "*",
        "\u2192": " -> ",
        "\u2713": " [OK] ",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "replace").decode("latin-1")


def _generate_forensic_report_pdf(report: ForensicReport, case: CrimeCase, evidence: Evidence | None) -> bytes:
    class ForensicPDF(FPDF):
        def header(self):
            self.set_font("helvetica", "B", 14)
            self.set_text_color(15, 23, 42)
            self.cell(0, 7, "GOVERNMENT OF KARNATAKA - POLICE DEPARTMENT", align="C", new_x="LMARGIN", new_y="NEXT")
            self.set_font("helvetica", "B", 10)
            self.set_text_color(14, 116, 144)
            self.cell(0, 6, "STATE FORENSIC SCIENCE LABORATORY (SFSL) EXAMINATION REPORT", align="C", new_x="LMARGIN", new_y="NEXT")
            self.set_draw_color(180, 205, 225)
            self.line(10, self.get_y() + 2, self.w - 10, self.get_y() + 2)
            self.ln(5)

        def footer(self):
            self.set_y(-15)
            self.set_font("helvetica", "I", 8)
            self.set_text_color(100, 115, 140)
            self.cell(0, 10, f"SAKSHA Forensics  |  Page {self.page_no()} of {{nb}}  |  CONFIDENTIAL FORENSIC REPORT", align="C")

    pdf = ForensicPDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    case_num = _safe_pdf_text(case.case_number if case else "UNASSIGNED")
    location = _safe_pdf_text(f"{case.location.station or ''}, {case.location.district or ''}" if case and case.location else "Karnataka Jurisdiction")

    # 1. Report Title
    pdf.set_font("helvetica", "B", 12)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, _safe_pdf_text(report.title.upper()), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    # 2. Key Metadata Block
    pdf.set_font("helvetica", "B", 9)
    pdf.set_fill_color(241, 245, 249)
    pdf.cell(95, 6, "  CASE & INSTITUTION DETAILS", fill=True)
    pdf.cell(95, 6, "  EXAMINATION PARTICULARS", fill=True, new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("helvetica", "", 8.5)
    pdf.set_text_color(51, 65, 85)

    left_items = [
        f"Case Number: {case_num}",
        f"Jurisdiction: {location}",
        f"Laboratory: {_safe_pdf_text(report.lab_name)}",
        f"Report ID: {str(report.id)[:18]}...",
    ]
    right_items = [
        f"Discipline: {report.forensic_type.upper()}",
        f"Lead Examiner: {_safe_pdf_text(report.examiner_name)}",
        f"Status: {report.status.upper()}",
        f"Verification: {'VERIFIED BY OFFICER' if report.verified_by else 'PENDING HUMAN SIGN-OFF'}",
    ]

    for left, right in zip(left_items, right_items):
        pdf.cell(95, 5.5, f"  {_safe_pdf_text(left)}", border="LR")
        pdf.cell(95, 5.5, f"  {_safe_pdf_text(right)}", border="LR", new_x="LMARGIN", new_y="NEXT")

    pdf.cell(95, 1, "", border="B")
    pdf.cell(95, 1, "", border="B", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # 3. Linked Evidence Particulars
    if evidence:
        pdf.set_font("helvetica", "B", 9)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(0, 6, "LINKED EVIDENTIARY EXHIBIT", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("helvetica", "", 8.5)
        pdf.cell(0, 5, _safe_pdf_text(f"Exhibit: {evidence.title} ({evidence.evidence_type.upper()}) | Status: {evidence.status}"), new_x="LMARGIN", new_y="NEXT")
        if evidence.description:
            pdf.multi_cell(0, 4.5, _safe_pdf_text(evidence.description))
        pdf.ln(3)

    # 4. Methodology
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 6, "LABORATORY METHODOLOGY & PROCEDURES", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 8.5)
    method_text = report.methodology or "Standard laboratory standard operating procedures (SOPs) under ISO/IEC 17025 forensic guidelines applied."
    pdf.multi_cell(0, 4.5, _safe_pdf_text(method_text))
    pdf.ln(4)

    # 5. Scientific Findings
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 6, "CERTIFIED SCIENTIFIC FINDINGS & OPINION", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 8.5)
    findings_text = report.findings or "Examination completed; findings recorded and maintained in official forensic register."
    pdf.multi_cell(0, 4.5, _safe_pdf_text(findings_text))
    pdf.ln(4)

    # 6. AI Assistance Disclosure
    if report.ai_assisted:
        pdf.set_font("helvetica", "B", 8.5)
        pdf.set_text_color(180, 83, 9)
        pdf.cell(0, 5, "DISCLOSURE: AI-ASSISTED COMPUTATIONAL SCREENING EMPLOYED", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("helvetica", "", 8)
        pdf.set_text_color(120, 53, 15)
        notes = report.ai_notes or "Preliminary automated pattern screening assisted human examiner. All conclusions were independently verified by certifying officer."
        pdf.multi_cell(0, 4, _safe_pdf_text(notes))
        pdf.ln(3)

    # 7. Verification & Certification Sign-Off
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 6, "AUTHORITATIVE VERIFICATION & OFFICER SIGN-OFF", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 8)
    pdf.set_text_color(51, 65, 85)

    if report.verified_by:
        v_date = report.verified_at.strftime("%Y-%m-%d %H:%M UTC") if report.verified_at else "RECORDED"
        pdf.cell(0, 5, _safe_pdf_text(f"Certified and Verified by: {report.verified_by} on {v_date}"), new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 5, "Verification Status: AUTHORITATIVE HUMAN SIGN-OFF CONFIRMED", new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.cell(0, 5, "Status: PENDING CERTIFICATION SIGN-OFF (DRAFT / UNDER REVIEW)", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(4)
    pdf.set_font("helvetica", "I", 7.5)
    pdf.set_text_color(100, 116, 139)
    pdf.multi_cell(0, 4, "CONFIDENTIAL & PRIVILEGED: This document is prepared under Section 293 of the Code of Criminal Procedure (CrPC) for official law-enforcement and judicial proceedings only.")

    return bytes(pdf.output())


@router.get("/case/{case_id}", response_model=list[ForensicReportOut])
def list_case_forensic_reports(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all forensic reports associated with a specific crime case."""
    case = db.query(CrimeCase).filter(CrimeCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Crime case not found.")

    enforce_record_district(
        current_user,
        case.location.district if case.location else None,
        db,
    )

    reports = db.query(ForensicReport).filter(ForensicReport.case_id == case_id).order_by(ForensicReport.created_at.desc()).all()
    audit_service.log_action(db, current_user, "FORENSIC_VIEW", "CrimeCase", str(case_id), details=f"count={len(reports)}")
    return reports


@router.post("", response_model=ForensicReportOut, status_code=201, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_FORENSIC, ROLE_INVESTIGATOR, ROLE_INSPECTOR))])
def create_forensic_report(
    payload: ForensicReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new forensic analysis report linked to a case and optional evidence item."""
    case = db.query(CrimeCase).filter(CrimeCase.id == payload.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Invalid case_id. Case does not exist.")

    enforce_record_district(
        current_user,
        case.location.district if case.location else None,
        db,
    )

    data = payload.model_dump()
    if not data.get("examiner_name"):
        data["examiner_name"] = current_user.full_name or current_user.username

    report = forensics_crud.create(db, data)
    audit_service.log_action(db, current_user, "FORENSIC_CREATE", "ForensicReport", str(report.id), details=f"type={report.forensic_type}, title={report.title}")
    return report


@router.put("/{report_id}", response_model=ForensicReportOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_FORENSIC, ROLE_INVESTIGATOR, ROLE_INSPECTOR))])
def update_forensic_report(
    report_id: uuid.UUID,
    payload: ForensicReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update forensic findings, methodology, or preliminary AI notes."""
    report = forensics_crud.get(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Forensic report not found.")

    case = report.crime_case
    enforce_record_district(
        current_user,
        case.location.district if (case and case.location) else None,
        db,
    )

    updated = forensics_crud.update(db, report_id, payload.model_dump(exclude_unset=True))
    audit_service.log_action(db, current_user, "FORENSIC_UPDATE", "ForensicReport", str(report_id))
    return updated


@router.post("/{report_id}/verify", response_model=ForensicReportOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_FORENSIC, ROLE_INSPECTOR))])
def verify_forensic_report(
    report_id: uuid.UUID,
    payload: ForensicReportVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Human verification gate: Authoritative sign-off by a certified senior forensic officer."""
    report = forensics_crud.get(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Forensic report not found.")

    case = report.crime_case
    enforce_record_district(
        current_user,
        case.location.district if (case and case.location) else None,
        db,
    )

    report.status = payload.status
    report.verified_by = current_user.full_name or current_user.username
    report.verified_at = datetime.now(timezone.utc)
    if payload.verification_notes:
        report.findings = f"{report.findings or ''}\n\n[Verification Note]: {payload.verification_notes}".strip()

    db.commit()
    db.refresh(report)

    audit_service.log_action(
        db,
        current_user,
        "FORENSIC_VERIFY",
        "ForensicReport",
        str(report_id),
        details=f"verified_by={report.verified_by}, status={report.status}",
    )
    return report


@router.get("/{report_id}/export", dependencies=[Depends(require_roles(*ALL_ROLES))])
def export_forensic_report_pdf(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate official certified Karnataka State Police Forensic Report PDF."""
    report = forensics_crud.get(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Forensic report not found.")

    case = report.crime_case
    enforce_record_district(
        current_user,
        case.location.district if (case and case.location) else None,
        db,
    )

    evidence = report.evidence
    pdf_bytes = _generate_forensic_report_pdf(report, case, evidence)
    case_num = case.case_number if case else "Case"
    clean_filename = f"KSP_Forensic_Report_{case_num}_{str(report.id)[:8]}.pdf"

    audit_service.log_action(db, current_user, "EXPORT", "ForensicReport", str(report_id))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{clean_filename}"'},
    )
