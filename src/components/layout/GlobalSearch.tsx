import { useState, useEffect, useRef } from 'react';
import { Search, Building2, Users, Target, CheckSquare, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useGlobalSearch, SearchResult } from '@/hooks/useGlobalSearch';

const typeConfig: Record<string, { icon: typeof Building2; label: string; color: string }> = {
  company: { icon: Building2, label: 'Empresa', color: 'text-blue-500' },
  contact: { icon: Users, label: 'Contato', color: 'text-green-500' },
  deal: { icon: Target, label: 'Deal', color: 'text-purple-500' },
  task: { icon: CheckSquare, label: 'Tarefa', color: 'text-orange-500' },
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { results, isSearching, search, clearResults } = useGlobalSearch();

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, search]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      clearResults();
    }
  }, [open, clearResults]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    navigate(result.href);
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="outline"
        className="w-full max-w-sm justify-start text-muted-foreground gap-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Busca Global</DialogTitle>
          </DialogHeader>
          
          {/* Search Input */}
          <div className="flex items-center border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar empresas, contatos, deals, tarefas..."
              className="border-0 focus-visible:ring-0 h-12"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-2">
            {isSearching && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Buscando...
              </div>
            )}

            {!isSearching && query.length >= 2 && results.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado para "{query}"
              </div>
            )}

            {!isSearching && query.length > 0 && query.length < 2 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Digite pelo menos 2 caracteres para buscar
              </div>
            )}

            {!isSearching && results.length > 0 && (
              <div className="space-y-1">
                {results.map((result, index) => {
                  const config = typeConfig[result.type];
                  const Icon = config.icon;

                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                        index === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className={cn("p-1.5 rounded-md bg-background border", config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{result.title}</p>
                        {result.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {!query && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p className="mb-2">Busque por empresas, contatos, deals ou tarefas</p>
                <p className="text-xs">
                  Pressione <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">↑</kbd>{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">↓</kbd> para navegar,{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Enter</kbd> para selecionar
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
