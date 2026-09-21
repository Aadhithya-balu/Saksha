import { useEffect } from 'react';

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = 'Saksha';
    };
  }, [title]);
}