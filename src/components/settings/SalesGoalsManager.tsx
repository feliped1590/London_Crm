import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSalesGoals, useAllSalesGoals, SalesGoal, SalesGoalInsert } from '@/hooks/useSalesGoals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Target, TrendingUp, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';

const periodTypeLabels: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

interface Profile {
  user_id: string;
  full_name: string;
}

export function SalesGoalsManager() {
  const { allGoals, isLoading } = useAllSalesGoals();
  const { createGoal, updateGoal, deleteGoal, getPeriodDates } = useSalesGoals();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SalesGoal | null>(null);
  const [formData, setFormData] = useState<Partial<SalesGoalInsert>>({
    user_id: '',
    period_type: 'monthly',
    period_start: '',
    period_end: '',
    target_value: 0,
    target_deals: 0,
  });

  // Fetch profiles for user selection
  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as Profile[];
    },
  });

  const resetForm = () => {
    setFormData({
      user_id: '',
      period_type: 'monthly',
      period_start: '',
      period_end: '',
      target_value: 0,
      target_deals: 0,
    });
    setEditingGoal(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (goal: SalesGoal) => {
    setEditingGoal(goal);
    setFormData({
      user_id: goal.user_id,
      period_type: goal.period_type,
      period_start: goal.period_start,
      period_end: goal.period_end,
      target_value: goal.target_value,
      target_deals: goal.target_deals,
    });
    setIsDialogOpen(true);
  };

  const handlePeriodTypeChange = (type: 'monthly' | 'quarterly' | 'yearly') => {
    const dates = getPeriodDates(type);
    setFormData({
      ...formData,
      period_type: type,
      period_start: dates.start,
      period_end: dates.end,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGoal) {
      updateGoal.mutate({ id: editingGoal.id, ...formData } as SalesGoal, {
        onSuccess: resetForm,
      });
    } else {
      createGoal.mutate(formData as SalesGoalInsert, {
        onSuccess: resetForm,
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteGoal.mutate(id);
  };

  const isGoalActive = (goal: SalesGoal) => {
    const now = new Date();
    const start = new Date(goal.period_start);
    const end = new Date(goal.period_end);
    return isWithinInterval(now, { start, end });
  };

  const getUserName = (userId: string) => {
    return profiles?.find(p => p.user_id === userId)?.full_name || 'Usuário desconhecido';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Group goals by user
  const goalsByUser = allGoals?.reduce((acc, goal) => {
    if (!acc[goal.user_id]) acc[goal.user_id] = [];
    acc[goal.user_id].push(goal);
    return acc;
  }, {} as Record<string, SalesGoal[]>) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Metas de Vendas</h2>
          <p className="text-sm text-muted-foreground">
            Configure metas de vendas para cada vendedor
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGoal ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="user_id">Vendedor *</Label>
                <SearchableSelect
                  options={(profiles || []).map(p => ({ value: p.user_id, label: p.full_name }))}
                  value={formData.user_id || null}
                  onChange={(v) => setFormData({ ...formData, user_id: v || '' })}
                  placeholder="Selecione um vendedor"
                  searchPlaceholder="Buscar vendedor..."
                  disabled={!!editingGoal}
                  allowClear={false}
                />
              </div>
              <div>
                <Label htmlFor="period_type">Período *</Label>
                <Select
                  value={formData.period_type}
                  onValueChange={(v) => handlePeriodTypeChange(v as 'monthly' | 'quarterly' | 'yearly')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(periodTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="period_start">Início</Label>
                  <Input
                    id="period_start"
                    type="date"
                    value={formData.period_start}
                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="period_end">Fim</Label>
                  <Input
                    id="period_end"
                    type="date"
                    value={formData.period_end}
                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="target_value">Meta de Valor (R$) *</Label>
                <Input
                  id="target_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="target_deals">Meta de Deals *</Label>
                <Input
                  id="target_deals"
                  type="number"
                  min="0"
                  value={formData.target_deals}
                  onChange={(e) => setFormData({ ...formData, target_deals: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createGoal.isPending || updateGoal.isPending}>
                  {editingGoal ? 'Atualizar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!allGoals?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Target className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma meta configurada</h3>
            <p className="text-muted-foreground">Crie metas para acompanhar o desempenho dos vendedores.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(goalsByUser).map(([userId, userGoals]) => (
            <Card key={userId}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {getUserName(userId)}
                </CardTitle>
                <CardDescription>{userGoals.length} meta(s) configurada(s)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userGoals.map((goal) => {
                    const isActive = isGoalActive(goal);
                    return (
                      <div
                        key={goal.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${isActive ? 'border-primary bg-primary/5' : ''}`}
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {format(parseISO(goal.period_start), 'dd/MM/yyyy', { locale: ptBR })} - {format(parseISO(goal.period_end), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            <Badge variant={isActive ? 'default' : 'secondary'}>
                              {periodTypeLabels[goal.period_type]}
                            </Badge>
                            {isActive && <Badge variant="outline" className="bg-primary/10">Ativa</Badge>}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Meta de Valor:</span>{' '}
                              <span className="font-medium">{formatCurrency(goal.target_value)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Meta de Deals:</span>{' '}
                              <span className="font-medium">{goal.target_deals}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(goal)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir meta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(goal.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
