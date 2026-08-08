import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Primitives';

/**
 * Hook para determinar el tamaño de página dinámico según el tipo de pantalla:
 * - Móvil (< 640px): 5 elementos por página
 * - Tablet (640px a 1023px): 8 elementos por página
 * - Computador (>= 1024px): 10 elementos por página
 */
export function usePageSize(): number {
  const getDynamicPageSize = (): number => {
    if (typeof window === 'undefined') return 10;
    const width = window.innerWidth;
    if (width < 640) return 5;
    if (width < 1024) return 8;
    return 10;
  };

  const [pageSize, setPageSize] = useState<number>(getDynamicPageSize);

  useEffect(() => {
    const handleResize = () => {
      setPageSize(getDynamicPageSize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return pageSize;
}

/**
 * Hook universal de paginación para listas/tablas en frontend
 */
export function useResponsivePagination<T>(items: T[]) {
  const pageSize = usePageSize();
  const [page, setPage] = useState<number>(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Ajustar página actual si el filtro reduce el número total de páginas
  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [items.length, page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    pageSize,
    totalPages,
    totalItems: items.length,
    pagedItems,
  };
}

/**
 * Componente de Controles de Paginación Universal
 */
export const TablePaginationControls: React.FC<{
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
}> = ({ page, totalPages, totalItems, pageSize, onPageChange }) => {
  if (totalItems === 0) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-2 py-3 border-t border-[var(--border)]">
      <div className="text-xs font-bold text-[var(--muted)]">
        Mostrando <span className="text-[var(--text)] font-mono">{startItem}</span> -{' '}
        <span className="text-[var(--text)] font-mono">{endItem}</span> de{' '}
        <span className="text-[var(--text)] font-mono">{totalItems}</span> registros (Página {page} de {totalPages})
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="text-xs py-1.5 px-3"
        >
          ◀ Anterior
        </Button>

        {/* Indicadores de páginas */}
        <div className="flex items-center gap-1 mx-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .map((p, index, array) => {
              const prevPage = array[index - 1];
              const showEllipsis = prevPage && p - prevPage > 1;
              return (
                <React.Fragment key={p}>
                  {showEllipsis && <span className="text-xs text-[var(--muted)] px-1">...</span>}
                  <button
                    type="button"
                    onClick={() => onPageChange(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                      p === page
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)]'
                    }`}
                  >
                    {p}
                  </button>
                </React.Fragment>
              );
            })}
        </div>

        <Button
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="text-xs py-1.5 px-3"
        >
          Siguiente ▶
        </Button>
      </div>
    </div>
  );
};
