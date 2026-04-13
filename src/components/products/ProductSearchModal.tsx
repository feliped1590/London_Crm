import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { Search, X, Clock, Loader2, FilterX } from 'lucide-react';
import { useProductSearch, type ProductSearchResult } from '@/hooks/useProductSearch';
import { useProductSearchState } from '@/hooks/useProductSearchState';
import { useRecentProducts } from '@/hooks/useRecentProducts';
import { useProductLookups } from '@/hooks/useProductLookups';
import { formatCurrency } from '@/lib/formatters';

interface ProductSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: ProductSearchResult) => void;
}

const PAGE_SIZE = 20;

export function ProductSearchModal({ open, onOpenChange, onSelect }: ProductSearchModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { filters, setFilter, clearFilters, hasActiveFilters, page, setPage } = useProductSearchState();
  const [debouncedText, setDebouncedText] = useState(filters.text || '');
  const [textInput, setTextInput] = useState(filters.text || '');

  // Debounce text input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedText(textInput);
      setFilter('text', textInput);
    }, 300);
    return () => clearTimeout(t);
  }, [textInput, setFilter]);

  // Auto-focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
      // Restore saved text
      setTextInput(filters.text || '');
    }
  }, [open]);

  const { products, total, isLoading, isFetching } = useProductSearch({
    filters: { ...filters, text: debouncedText },
    page,
    limit: PAGE_SIZE,
    enabled: open,
  });

  const { recentProducts, addRecent } = useRecentProducts();
  const { familias, grupos, subgrupos, classes } = useProductLookups();

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSelect = useCallback((product: ProductSearchResult) => {
    addRecent(product.id);
    onSelect(product);
    onOpenChange(false);
  }, [addRecent, onSelect, onOpenChange]);

  // ENTER selects first item
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && products.length > 0) {
      e.preventDefault();
      handleSelect(products[0]);
    }
  }, [products, handleSelect]);

  const handleClear = useCallback(() => {
    clearFilters();
    setTextInput('');
    setDebouncedText('');
  }, [clearFilters]);

  // Dependent filter: filter groups by family (client-side from cached lookups)
  // Since lookups are independent in this system, no real dependency exists.
  // We just display all active items from each lookup.

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Pesquisa Avançada de Produtos
          </DialogTitle>
        </DialogHeader>

        {/* Recent Products */}
        {recentProducts.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Recentes
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {recentProducts.map(p => (
                <TooltipProvider key={p.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => handleSelect(p)}
                      >
                        {p.sku}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>{p.name}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input
                ref={searchInputRef}
                placeholder="Buscar por código ou descrição..."
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div>
              <Label className="text-xs">Família</Label>
              <Select value={filters.family_id || ''} onValueChange={v => setFilter('family_id', v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  {familias.items.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Grupo</Label>
              <Select value={filters.grupo_id || ''} onValueChange={v => setFilter('grupo_id', v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {grupos.items.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Subgrupo</Label>
              <Select value={filters.subgrupo_id || ''} onValueChange={v => setFilter('subgrupo_id', v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {subgrupos.items.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Classe</Label>
              <Select value={filters.class_id || ''} onValueChange={v => setFilter('class_id', v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  {classes.items.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs">
              <FilterX className="h-3.5 w-3.5 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              Nenhum produto encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">SKU</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[100px] text-right">Preço Un.</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-accent/50" onDoubleClick={() => handleSelect(p)}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="truncate max-w-[300px]">{p.name}</TableCell>
                    <TableCell className="text-right text-sm">{p.unit_price ? formatCurrency(p.unit_price) : '-'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleSelect(p)}>
                        Selecionar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer: count + pagination */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {isFetching && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
            {total} produto{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </span>
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                {page > 0 && (
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={e => { e.preventDefault(); setPage(page - 1); }} />
                  </PaginationItem>
                )}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = page <= 2 ? i : page + i - 2;
                  if (p >= totalPages) return null;
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink href="#" isActive={p === page} onClick={e => { e.preventDefault(); setPage(p); }}>
                        {p + 1}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                {page < totalPages - 1 && (
                  <PaginationItem>
                    <PaginationNext href="#" onClick={e => { e.preventDefault(); setPage(page + 1); }} />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
