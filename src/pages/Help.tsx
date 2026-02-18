import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  LayoutDashboard, 
  Target, 
  Building2, 
  Users, 
  Package, 
  DollarSign, 
  ShoppingCart, 
  CheckSquare, 
  BarChart3, 
  Settings, 
  Lightbulb,
  ChevronRight,
  ExternalLink,
  BookOpen,
  LogIn,
  Download,
  Calendar,
  MessageSquare,
  Bot,
  Brain,
  Sparkles,
  Globe,
  Mail,
  TrendingUp,
  Shield,
  Workflow,
  Clock,
  Bell,
  FileText,
  Zap,
  Eye,
  Filter,
  ArrowLeftRight,
  UserCheck,
  PieChart
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  path?: string;
  adminOnly?: boolean;
  content: {
    subtitle: string;
    steps?: string[];
    tips?: string[];
    warnings?: string[];
  }[];
}

const helpSections: HelpSection[] = [
  {
    id: 'primeiros-passos',
    title: '1. Primeiros Passos',
    icon: LogIn,
    description: 'Introdução ao sistema, login, navegação e conceitos fundamentais.',
    content: [
      {
        subtitle: 'Login e Autenticação',
        steps: [
          'Acesse o sistema pelo endereço fornecido pelo administrador.',
          'Insira seu e-mail e senha cadastrados pelo administrador.',
          'Clique em "Entrar" para acessar o sistema.',
          'Caso seja seu primeiro acesso, utilize a opção "Criar conta" com o e-mail autorizado.',
          'Confirme seu e-mail através do link enviado para sua caixa de entrada.',
        ],
        tips: [
          'Mantenha suas credenciais em local seguro.',
          'Ao finalizar o trabalho, utilize o botão "Sair" no menu lateral para encerrar sua sessão.',
          'Em caso de esquecimento da senha, utilize a opção "Esqueci minha senha".',
        ],
      },
      {
        subtitle: 'Navegação pelo Sistema',
        steps: [
          'O menu lateral esquerdo contém todos os módulos disponíveis.',
          'Clique em qualquer item do menu para acessar o módulo desejado.',
          'No mobile, toque no ícone de menu (☰) para abrir a navegação.',
          'O módulo atual fica destacado com cor diferenciada no menu.',
          'Use a barra de busca global (no topo) para encontrar empresas, contatos, negócios ou tarefas rapidamente.',
        ],
        tips: [
          'O menu se adapta às suas permissões — você só verá os módulos autorizados.',
          'Use atalhos de teclado: Ctrl+K para abrir a busca global.',
        ],
      },
      {
        subtitle: 'Entendendo os Perfis de Acesso',
        steps: [
          'Administrador: acesso total a todos os módulos e configurações.',
          'Vendedor: acesso ao pipeline, clientes e tarefas (próprios ou da equipe).',
          'Atendente: acesso focado em atendimento e suporte ao cliente.',
          'Cada perfil pode ter acesso "Total" ou "Restrito" por módulo.',
          'Acesso Restrito significa que você só visualiza dados atribuídos a você.',
        ],
        warnings: [
          'Tentativas de acessar dados não autorizados são registradas no sistema.',
        ],
      },
      {
        subtitle: 'Busca Global',
        steps: [
          'A barra de busca no topo permite encontrar qualquer registro do sistema.',
          'Digite o nome de uma empresa, contato, negócio ou tarefa.',
          'Os resultados são categorizados por tipo (Empresa, Contato, Negócio, Tarefa).',
          'Clique no resultado para ir diretamente ao registro.',
        ],
        tips: [
          'Use a busca para encontrar rapidamente um cliente antes de uma ligação.',
          'A busca considera razão social, nome fantasia, CNPJ e nome de contatos.',
        ],
      },
    ],
  },
  {
    id: 'hoje',
    title: '2. Meu Dia (Hoje)',
    icon: Calendar,
    description: 'Visão consolidada das atividades do dia e prioridades.',
    path: '/today',
    content: [
      {
        subtitle: 'Visão Geral do Dia',
        steps: [
          'Acesse o módulo "Hoje" no menu lateral.',
          'Veja um resumo das suas tarefas pendentes para hoje.',
          'Visualize negócios que precisam de atenção (estagnados ou com SLA estourado).',
          'Acompanhe suas metas diárias de atividades.',
        ],
        tips: [
          'Comece seu dia sempre por esta tela para ter clareza das prioridades.',
          'Configure alertas de notificação para não perder prazos.',
        ],
      },
      {
        subtitle: 'Tarefas do Dia',
        steps: [
          'A lista mostra todas as tarefas com vencimento para hoje.',
          'Clique no checkbox para marcar uma tarefa como concluída.',
          'Clique na tarefa para ver detalhes ou editar.',
          'Tarefas atrasadas aparecem destacadas em vermelho.',
        ],
      },
      {
        subtitle: 'Negócios Estagnados',
        steps: [
          'O card "Negócios Estagnados" mostra oportunidades paradas por muito tempo.',
          'Cada negócio exibe há quantos dias está sem movimentação.',
          'Clique no negócio para acessar o pipeline e tomar uma ação.',
        ],
        warnings: [
          'Negócios estagnados prejudicam sua taxa de conversão — tome uma ação!',
        ],
      },
      {
        subtitle: 'Resumo de Performance',
        steps: [
          'Veja quantas atividades você completou hoje vs. sua meta.',
          'Acompanhe o progresso do seu funil de vendas.',
          'Compare seu desempenho com períodos anteriores.',
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    title: '3. Dashboard',
    icon: LayoutDashboard,
    description: 'Painel principal com métricas e indicadores do negócio.',
    path: '/dashboard',
    content: [
      {
        subtitle: 'Cards de Estatísticas',
        steps: [
          'Os cards no topo mostram métricas importantes em tempo real.',
          'Total de Negócios: quantidade de oportunidades ativas no funil.',
          'Valor em Aberto: soma dos valores de todos os negócios em andamento.',
          'Taxa de Conversão: percentual de negócios ganhos vs. total.',
          'Ticket Médio: valor médio dos negócios fechados.',
        ],
        tips: [
          'Clique em um card para ver mais detalhes ou ir ao módulo relacionado.',
          'Compare os valores com o período anterior (indicador de tendência).',
        ],
      },
      {
        subtitle: 'Widget de Metas',
        steps: [
          'O widget de metas mostra seu progresso em relação aos objetivos definidos.',
          'Barras de progresso indicam o percentual atingido.',
          'Metas podem ser de receita, quantidade de negócios ou atividades.',
          'Cores indicam status: verde (no caminho), amarelo (atenção), vermelho (atrasado).',
        ],
      },
      {
        subtitle: 'Carteira do Vendedor',
        steps: [
          'Visualize a distribuição da sua carteira de clientes.',
          'Veja quais empresas têm negócios ativos.',
          'Identifique clientes inativos que precisam de atenção.',
        ],
      },
      {
        subtitle: 'Personalizar Dashboard',
        steps: [
          'Clique no botão "Personalizar" no canto superior direito.',
          'Adicione ou remova widgets conforme sua necessidade.',
          'Arraste os widgets para reorganizar a disposição.',
          'Clique em "Salvar" para manter suas preferências.',
        ],
        tips: [
          'Cada usuário pode ter seu próprio layout de dashboard.',
          'Widgets personalizados são salvos automaticamente.',
        ],
      },
    ],
  },
  {
    id: 'pipeline',
    title: '4. Pipeline de Vendas',
    icon: Target,
    description: 'Gestão de oportunidades de negócio através de etapas do funil.',
    path: '/pipeline',
    content: [
      {
        subtitle: 'Visão Kanban vs Lista',
        steps: [
          'Use os botões no topo para alternar entre visualização Kanban e Lista.',
          'Kanban: cards organizados em colunas por etapa — ideal para gestão visual.',
          'Lista: tabela ordenável com todas as informações em uma linha — ideal para análise.',
          'Ambas as visualizações mostram os mesmos dados, apenas a apresentação muda.',
        ],
        tips: [
          'Use Kanban para reuniões de pipeline e visão geral.',
          'Use Lista para filtrar, ordenar e analisar detalhadamente.',
        ],
      },
      {
        subtitle: 'Seletor de Pipeline',
        steps: [
          'No topo da tela, selecione qual pipeline deseja visualizar.',
          'Pipelines diferentes podem ter etapas e regras distintas.',
          'Exemplo: Pipeline de Vendas Novas vs. Pipeline de Renovação.',
          'Cada pipeline tem suas próprias métricas e SLAs.',
        ],
      },
      {
        subtitle: 'Criar Novo Negócio',
        steps: [
          'Clique no botão "Novo Negócio" no canto superior direito.',
          'Preencha o Nome do negócio (obrigatório) — use nome descritivo.',
          'Informe o Valor estimado da oportunidade.',
          'Selecione a Empresa relacionada (cliente).',
          'Escolha o Contato principal para este negócio.',
          'Defina a Data Prevista de fechamento.',
          'Selecione a etapa inicial do funil.',
          'Clique em "Criar" para salvar.',
        ],
        tips: [
          'Nomes de negócios claros facilitam a identificação: "Projeto ERP - Empresa X".',
          'Valores realistas melhoram a precisão das previsões.',
        ],
      },
      {
        subtitle: 'Mover entre Etapas (Kanban)',
        steps: [
          'Clique e segure no card do negócio.',
          'Arraste para a coluna da etapa desejada.',
          'Solte o card para confirmar a mudança.',
          'Um registro automático é criado no histórico.',
        ],
        warnings: [
          'Ao mover para "Fechado (Perdido)", você deverá informar o motivo da perda.',
          'Algumas etapas podem ter checklist obrigatório — complete antes de avançar.',
          'Movimentações para trás podem exigir justificativa.',
        ],
      },
      {
        subtitle: 'Checklist de Etapa',
        steps: [
          'Algumas etapas possuem checklist de atividades obrigatórias.',
          'Clique no card do negócio para ver o checklist.',
          'Marque os itens conforme forem completados.',
          'Só é possível avançar de etapa quando todos os itens obrigatórios estão marcados.',
        ],
        tips: [
          'Checklists garantem que seu processo de vendas seja seguido corretamente.',
          'Itens opcionais são recomendados, mas não impedem o avanço.',
        ],
      },
      {
        subtitle: 'Painel de Detalhes do Negócio',
        steps: [
          'Clique no card ou linha do negócio para abrir o painel lateral.',
          'Aba "Dados": informações gerais, valores e campos personalizados.',
          'Aba "Propostas": criar, visualizar e gerenciar propostas comerciais.',
          'Aba "Equipe": adicionar outros participantes ao negócio.',
          'Aba "Histórico": visualizar timeline de alterações e atividades.',
          'Aba "Etapas": ver o tempo gasto em cada etapa do funil.',
        ],
      },
      {
        subtitle: 'Ações Rápidas do Negócio',
        steps: [
          'No painel do negócio, use os botões de ações rápidas:',
          'WhatsApp: enviar mensagem ao contato principal.',
          'Criar Tarefa: agendar follow-up ou atividade.',
          'Converter em Pedido: transformar negócio ganho em pedido.',
          'Registrar Atividade: adicionar nota, ligação ou reunião.',
        ],
      },
      {
        subtitle: 'Indicador de SLA',
        steps: [
          'O badge colorido no card indica o status de SLA.',
          'Verde: dentro do prazo esperado para a etapa.',
          'Amarelo: próximo do limite — ação recomendada.',
          'Vermelho: SLA estourado — ação urgente necessária.',
          'Ao clicar, veja detalhes de quanto tempo está na etapa.',
        ],
        warnings: [
          'Negócios com SLA vermelho impactam negativamente seus indicadores.',
        ],
      },
      {
        subtitle: 'Filtros Avançados',
        steps: [
          'Use os filtros acima do pipeline para refinar a visualização.',
          'Responsável: "Meus negócios" ou selecione um vendedor específico.',
          'Etapa: visualize apenas uma etapa específica.',
          'Empresa: filtre negócios de um cliente.',
          'Período: defina intervalo de datas de criação ou fechamento.',
          'Status de SLA: filtre por negócios dentro/fora do prazo.',
        ],
        tips: [
          'Combine múltiplos filtros para análises específicas.',
          'Filtros são salvos na sessão — recarregue para limpar.',
        ],
      },
      {
        subtitle: 'Registrar Motivo de Perda',
        steps: [
          'Ao mover um negócio para "Perdido", informe o motivo.',
          'Selecione um motivo da lista (ex: Preço, Concorrência, Timing).',
          'Adicione observações detalhadas sobre a perda.',
          'Esses dados alimentam os relatórios de motivos de perda.',
        ],
        tips: [
          'Motivos de perda bem registrados ajudam a melhorar seu processo comercial.',
        ],
      },
    ],
  },
  {
    id: 'empresas',
    title: '5. Empresas',
    icon: Building2,
    description: 'Cadastro e gestão de empresas clientes e prospects.',
    path: '/companies',
    content: [
      {
        subtitle: 'Cadastrar Nova Empresa',
        steps: [
          'Clique em "Nova Empresa" no canto superior direito.',
          'Preencha a Razão Social (obrigatório).',
          'Informe o CNPJ — o sistema busca automaticamente dados da Receita Federal.',
          'Complete Nome Fantasia e Inscrição Estadual se aplicável.',
          'Adicione endereço completo: logradouro, cidade, estado, CEP.',
          'Informe telefone e e-mail de contato.',
          'Selecione o Responsável (vendedor) pela conta.',
          'Clique em "Salvar" para criar a empresa.',
        ],
        tips: [
          'A busca por CNPJ preenche automaticamente razão social e endereço.',
          'Empresas podem ser importadas do ERP via integração Iniflex.',
        ],
      },
      {
        subtitle: 'Consulta de CNPJ',
        steps: [
          'Ao digitar um CNPJ válido, clique no botão de busca.',
          'O sistema consulta a Receita Federal e preenche os dados.',
          'Revise as informações antes de salvar.',
          'Dados como situação cadastral e data de abertura são importados.',
        ],
      },
      {
        subtitle: 'Indicadores no Card da Empresa',
        steps: [
          'A coluna "Funil" mostra badges com quantidade de negócios por status.',
          'Azul: negócios em andamento.',
          'Verde: negócios ganhos.',
          'Vermelho: negócios perdidos.',
          'Clique no badge para ver a lista de negócios.',
        ],
      },
      {
        subtitle: 'Tabela de Preços da Empresa',
        steps: [
          'Ao editar uma empresa, veja a seção "Tabela de Preços".',
          'Empresas podem ter tabelas de preços específicas vinculadas.',
          'Ao criar propostas para esta empresa, os preços serão aplicados automaticamente.',
          'Se não houver tabela específica, a tabela padrão é utilizada.',
        ],
        tips: [
          'Configure tabelas de preços no módulo "Tabelas de Preços".',
        ],
      },
      {
        subtitle: 'Histórico de Auditoria',
        steps: [
          'Clique na aba "Histórico" ao editar uma empresa.',
          'Veja todas as alterações realizadas no cadastro.',
          'Cada registro mostra: data, usuário, campo alterado, valor anterior e novo.',
          'Use para rastrear quem fez alterações importantes.',
        ],
      },
      {
        subtitle: 'Empresas Matriz e Filiais',
        steps: [
          'Empresas podem ser vinculadas como Matriz ou Filial.',
          'No campo "Empresa Matriz", selecione a matriz se for uma filial.',
          'Filiais herdam algumas configurações da matriz.',
          'Relatórios podem agrupar dados por grupo empresarial.',
        ],
      },
    ],
  },
  {
    id: 'contatos',
    title: '6. Contatos',
    icon: Users,
    description: 'Cadastro de pessoas de contato vinculadas às empresas.',
    path: '/contacts',
    content: [
      {
        subtitle: 'Cadastrar Novo Contato',
        steps: [
          'Clique em "Novo Contato" no canto superior direito.',
          'Preencha Nome (obrigatório) e Sobrenome.',
          'Informe E-mail — usado para envio de propostas.',
          'Adicione Telefone e Celular (com DDD).',
          'Defina o Cargo e Departamento na empresa.',
          'Vincule o contato a uma Empresa.',
          'Selecione o Responsável (vendedor).',
          'Clique em "Salvar".',
        ],
      },
      {
        subtitle: 'Tipo de Pessoa',
        steps: [
          'Selecione o tipo: PF (Pessoa Física) ou PJ (Pessoa Jurídica).',
          'Para PF, informe o CPF do contato.',
          'O sistema valida automaticamente o formato do CPF.',
          'Contatos PJ podem ter CNPJ próprio (representantes, por exemplo).',
        ],
      },
      {
        subtitle: 'Acessar WhatsApp do Contato',
        steps: [
          'Clique no ícone do WhatsApp ao lado do campo celular.',
          'O sistema abrirá a conversa no módulo WhatsApp integrado.',
          'Você poderá ver histórico de mensagens e enviar novas.',
          'Templates de mensagens podem ser usados para agilizar.',
        ],
        tips: [
          'Certifique-se de que o celular está no formato correto: (XX) XXXXX-XXXX.',
        ],
      },
      {
        subtitle: 'Campos Personalizados',
        steps: [
          'Contatos podem ter campos personalizados configurados pelo admin.',
          'Campos extras aparecem na seção "Campos Personalizados".',
          'Preencha conforme as necessidades do seu processo.',
          'Campos obrigatórios impedem o salvamento se vazios.',
        ],
      },
    ],
  },
  {
    id: 'produtos',
    title: '7. Produtos',
    icon: Package,
    description: 'Catálogo de produtos com especificações técnicas e preços.',
    path: '/products',
    content: [
      {
        subtitle: 'Cadastrar Produto',
        steps: [
          'Clique em "Novo Produto" no canto superior direito.',
          'Informe o SKU (código único obrigatório).',
          'Preencha o Nome do produto.',
          'Adicione uma Descrição detalhada.',
          'Selecione a Categoria do produto.',
          'Defina o Preço Unitário base.',
        ],
      },
      {
        subtitle: 'Especificações Técnicas',
        steps: [
          'Informe as dimensões: Largura, Comprimento e Espessura.',
          'Selecione o Material (ex: Aço, Alumínio, Plástico, Borracha).',
          'Escolha a Cor do produto.',
          'Defina a Unidade de Medida (un, kg, m², m, etc.).',
        ],
        tips: [
          'Medidas são utilizadas para cálculos automáticos em propostas.',
          'Produtos sem medidas podem ter cálculos manuais.',
        ],
      },
      {
        subtitle: 'Ativar/Inativar Produtos',
        steps: [
          'Use o toggle "Ativo/Inativo" para controlar a disponibilidade.',
          'Produtos inativos não aparecem nas seleções de propostas e pedidos.',
          'Produtos inativos mantêm todo o histórico anterior.',
          'Útil para produtos descontinuados.',
        ],
      },
      {
        subtitle: 'Filtros e Busca',
        steps: [
          'Use a barra de busca para encontrar por SKU, nome ou descrição.',
          'Filtre por Categoria para ver produtos específicos.',
          'Filtre por Status (Ativo/Inativo).',
          'Ordene por nome, preço ou data de criação.',
        ],
      },
    ],
  },
  {
    id: 'precos',
    title: '8. Tabelas de Preços',
    icon: DollarSign,
    description: 'Políticas de preços, descontos e condições comerciais.',
    path: '/pricing',
    content: [
      {
        subtitle: 'Criar Nova Tabela',
        steps: [
          'Clique em "Nova Tabela de Preços".',
          'Defina um nome identificador (ex: "Distribuidor", "Varejo", "VIP").',
          'Adicione uma descrição explicando as condições.',
          'Marque se é a tabela padrão do sistema.',
          'Defina as datas de validade (início e fim).',
        ],
      },
      {
        subtitle: 'Definir Regras de Desconto',
        steps: [
          'Na aba "Regras", adicione as condições de preço.',
          'Regra por Quantidade: desconto a partir de X unidades.',
          'Regra por Produto: preço fixo ou desconto para produto específico.',
          'Regra por Categoria: desconto para toda uma categoria.',
          'Defina a prioridade (ordem de aplicação das regras).',
        ],
        tips: [
          'Regras mais específicas devem ter maior prioridade.',
          'Exemplo: regra de produto sobrescreve regra de categoria.',
        ],
      },
      {
        subtitle: 'Vincular a Clientes',
        steps: [
          'Na aba "Vínculos", associe a tabela a empresas ou contatos.',
          'Busque o cliente pelo nome ou CNPJ.',
          'Clique em "Adicionar" para vincular.',
          'Clientes vinculados terão os preços aplicados automaticamente em propostas.',
        ],
        warnings: [
          'Um cliente pode ter apenas uma tabela ativa por vez.',
          'Ao vincular nova tabela, a anterior é automaticamente removida.',
        ],
      },
      {
        subtitle: 'Validade da Tabela',
        steps: [
          'Defina as datas de início e fim de validade.',
          'Tabelas com data expirada ficam inativas automaticamente.',
          'Propostas criadas com tabela expirada usarão a tabela padrão.',
          'Você receberá alertas sobre tabelas próximas do vencimento.',
        ],
      },
    ],
  },
  {
    id: 'pedidos',
    title: '9. Pedidos',
    icon: ShoppingCart,
    description: 'Gestão de pedidos de venda e workflow de aprovação.',
    path: '/orders',
    content: [
      {
        subtitle: 'Criar Pedido Manual',
        steps: [
          'Clique em "Novo Pedido" no canto superior direito.',
          'Selecione a Empresa cliente.',
          'Escolha o Contato responsável.',
          'Adicione os itens do pedido (produto, quantidade, preço).',
          'Revise o valor total e condições.',
          'Clique em "Salvar" para criar o pedido como Pendente.',
        ],
      },
      {
        subtitle: 'Pedido via Proposta Aprovada',
        steps: [
          'Quando uma proposta é aprovada pelo cliente, um pedido é criado automaticamente.',
          'O pedido herda todos os itens, preços e condições da proposta.',
          'O status inicial é "Pendente".',
          'Você pode editar o pedido antes de processá-lo.',
        ],
        tips: [
          'Propostas aprovadas são a forma mais segura de gerar pedidos — evita erros.',
        ],
      },
      {
        subtitle: 'Workflow de Aprovação',
        steps: [
          'Pedidos seguem um fluxo de aprovação configurável.',
          'Vendedor libera o pedido: Pendente → Em Produção.',
          'Administrador controla etapas posteriores.',
          'Cada mudança de status é registrada com data/hora e usuário.',
        ],
      },
      {
        subtitle: 'Status do Pedido',
        steps: [
          'Pendente: aguardando aprovação para produção.',
          'Em Produção: pedido autorizado e em fabricação.',
          'Produzido: produto pronto para faturamento.',
          'Faturado: nota fiscal emitida.',
          'Entregue: pedido entregue ao cliente.',
          'Cancelado: pedido cancelado (requer justificativa).',
        ],
      },
      {
        subtitle: 'Histórico de Aprovações',
        steps: [
          'Clique no pedido para ver detalhes.',
          'A timeline de aprovações mostra todas as etapas.',
          'Cada aprovação registra: status anterior, novo status, data e responsável.',
          'Notas de aprovação ficam registradas para consulta.',
        ],
      },
    ],
  },
  {
    id: 'tarefas',
    title: '10. Tarefas',
    icon: CheckSquare,
    description: 'Gestão de atividades, follow-ups e compromissos.',
    path: '/tasks',
    content: [
      {
        subtitle: 'Criar Nova Tarefa',
        steps: [
          'Clique em "Nova Tarefa" no canto superior direito.',
          'Defina o Título da tarefa (obrigatório) — seja específico.',
          'Adicione uma Descrição detalhada do que precisa ser feito.',
          'Selecione a Data e Hora de vencimento.',
          'Escolha a Prioridade (Baixa, Média, Alta, Urgente).',
          'Vincule a uma Empresa, Contato ou Negócio relacionado.',
          'Clique em "Salvar".',
        ],
      },
      {
        subtitle: 'Calendário de Tarefas',
        steps: [
          'Use a aba "Calendário" para ver tarefas em formato visual.',
          'Visualizações disponíveis: Dia, Semana, Mês.',
          'Arraste e solte tarefas para reagendar.',
          'Clique em uma data vazia para criar nova tarefa.',
          'Cores indicam prioridade e status.',
        ],
        tips: [
          'A visão de calendário ajuda a identificar dias sobrecarregados.',
          'Tarefas do Google Calendar aparecem integradas (se configurado).',
        ],
      },
      {
        subtitle: 'Prioridades',
        steps: [
          'Baixa (cinza): tarefas sem urgência.',
          'Média (azul): importância normal.',
          'Alta (laranja): requer atenção prioritária.',
          'Urgente (vermelho): ação imediata necessária.',
        ],
        tips: [
          'Tarefas urgentes aparecem sempre no topo das listas.',
          'Use urgente com moderação para manter o significado.',
        ],
      },
      {
        subtitle: 'Vincular a Entidades',
        steps: [
          'Associe a tarefa a uma Empresa para atividades gerais do cliente.',
          'Vincule a um Contato para follow-ups pessoais.',
          'Relacione a um Negócio para ações específicas do pipeline.',
          'Entidades vinculadas aparecem como links clicáveis na tarefa.',
        ],
      },
      {
        subtitle: 'Concluir e Gerenciar Tarefas',
        steps: [
          'Clique no checkbox ao lado da tarefa para marcá-la como concluída.',
          'Tarefas concluídas são movidas para a aba "Concluídas".',
          'A data de conclusão é registrada automaticamente.',
          'Você pode reabrir uma tarefa concluída se necessário.',
        ],
      },
      {
        subtitle: 'Filtros de Tarefas',
        steps: [
          'Pendentes: tarefas ainda não concluídas.',
          'Atrasadas: tarefas com data de vencimento ultrapassada.',
          'Concluídas: tarefas já finalizadas.',
          'Minhas Tarefas: apenas tarefas atribuídas a você.',
          'Todas: visualizar tarefas de toda a equipe (se permitido).',
        ],
      },
    ],
  },
  {
    id: 'insights',
    title: '11. Insights',
    icon: Lightbulb,
    description: 'Alertas inteligentes e recomendações de ação.',
    path: '/insights',
    content: [
      {
        subtitle: 'Visão Geral dos Insights',
        steps: [
          'O módulo Insights analisa seus dados e identifica situações que requerem atenção.',
          'Cards de resumo mostram quantidade de alertas por categoria.',
          'Clique em cada categoria para ver os detalhes.',
          'Insights são atualizados em tempo real conforme os dados mudam.',
        ],
      },
      {
        subtitle: 'Negócios Estagnados',
        steps: [
          'Lista negócios que estão parados há mais tempo que o esperado.',
          'Mostra há quantos dias o negócio está na etapa atual.',
          'Indica o SLA da etapa e se está estourado.',
          'Clique para ir diretamente ao negócio no pipeline.',
        ],
        tips: [
          'Defina SLAs realistas para cada etapa do pipeline.',
        ],
      },
      {
        subtitle: 'Propostas Expirando',
        steps: [
          'Mostra propostas com validade próxima do vencimento.',
          'Ordena por urgência (mais próximas primeiro).',
          'Indica valor e cliente de cada proposta.',
          'Permite enviar lembrete ao cliente diretamente.',
        ],
      },
      {
        subtitle: 'Tarefas Atrasadas',
        steps: [
          'Lista tarefas que já passaram da data de vencimento.',
          'Mostra há quantos dias está atrasada.',
          'Permite concluir ou reagendar diretamente.',
          'Cores indicam gravidade do atraso.',
        ],
      },
      {
        subtitle: 'Clientes Inativos',
        steps: [
          'Identifica clientes sem interação há muito tempo.',
          'Mostra a última atividade registrada.',
          'Sugere ações de reativação.',
          'Útil para campanhas de reengajamento.',
        ],
      },
    ],
  },
  {
    id: 'relatorios',
    title: '12. Relatórios',
    icon: BarChart3,
    description: 'Análises, métricas e relatórios de desempenho.',
    path: '/reports',
    content: [
      {
        subtitle: 'Dashboard de Relatórios',
        steps: [
          'O módulo Relatórios oferece múltiplas abas de análise.',
          'Dashboard: visão geral personalizada com widgets.',
          'Operacional: monitoramento de SLA e atividades.',
          'BI Avançado: inteligência de negócios com drill-down.',
        ],
      },
      {
        subtitle: 'Funil de Vendas',
        steps: [
          'Visualize a distribuição de negócios por etapa.',
          'O gráfico mostra quantidade e valor em cada fase.',
          'Compare a taxa de conversão entre etapas.',
          'Identifique gargalos onde negócios estão parando.',
        ],
      },
      {
        subtitle: 'Velocidade do Pipeline',
        steps: [
          'Analise o tempo médio em cada etapa do funil.',
          'Compare com períodos anteriores.',
          'Identifique etapas com tempo acima da média.',
          'Use para definir SLAs mais realistas.',
        ],
      },
      {
        subtitle: 'Motivos de Perda',
        steps: [
          'Veja os principais motivos de negócios perdidos.',
          'Gráfico de pizza mostra distribuição percentual.',
          'Clique em um motivo para ver os negócios relacionados.',
          'Use para melhorar sua abordagem comercial.',
        ],
        tips: [
          'Registrar motivos de perda corretamente é fundamental para esta análise.',
        ],
      },
      {
        subtitle: 'Relatórios Operacionais',
        steps: [
          'Monitor de SLA: veja negócios dentro/fora do prazo.',
          'Grid de Status de Pedidos: acompanhe o fluxo de pedidos.',
          'Log de Atividades: histórico de ações dos usuários.',
          'Filtros por período, vendedor e pipeline.',
        ],
      },
      {
        subtitle: 'Exportar Relatórios',
        steps: [
          'Clique no botão "Imprimir/PDF" para exportar.',
          'Selecione as seções que deseja incluir.',
          'O relatório será gerado em formato PDF.',
          'Útil para reuniões e apresentações.',
        ],
      },
    ],
  },
  {
    id: 'bi-avancado',
    title: '13. BI Avançado',
    icon: Brain,
    description: 'Inteligência de negócios com drill-down e análises preditivas.',
    path: '/reports',
    content: [
      {
        subtitle: 'Acessando o BI Avançado',
        steps: [
          'Acesse o módulo Relatórios.',
          'Clique na aba "BI Avançado".',
          'Use os filtros para definir o período e escopo da análise.',
          'Os dados são carregados automaticamente.',
        ],
      },
      {
        subtitle: 'Filtros Globais',
        steps: [
          'Período: selecione o intervalo de datas para análise.',
          'Vendedor: filtre por vendedor específico ou veja toda a equipe.',
          'Pipeline: escolha qual funil analisar.',
          'Filtros afetam todas as seções simultaneamente.',
        ],
      },
      {
        subtitle: 'Saúde do Pipeline',
        steps: [
          'Visualize métricas de saúde do seu funil por etapa.',
          'Tempo médio em etapa: quantos dias em média.',
          'Violações de SLA: quantos negócios estouraram o prazo.',
          'Taxa de avanço: percentual que avança para próxima etapa.',
          'Clique em qualquer número para ver a lista detalhada.',
        ],
      },
      {
        subtitle: 'Performance dos Vendedores',
        steps: [
          'Compare o desempenho dos vendedores.',
          'Métricas: negócios ganhos, valor total, taxa de conversão.',
          'Comparação com período anterior (tendência).',
          'Tempo médio de ciclo de vendas.',
          'Identifique top performers e quem precisa de apoio.',
        ],
        tips: [
          'Use esta análise em reuniões de coaching com a equipe.',
        ],
      },
      {
        subtitle: 'Detecção de Anomalias',
        steps: [
          'O sistema identifica automaticamente situações anômalas.',
          'Pipeline inchado: muitos negócios sem conversão.',
          'Negócios de alto valor parados: oportunidades grandes estagnadas.',
          'Quedas bruscas de performance: alertas de tendência.',
          'Cada anomalia tem explicação e ação sugerida.',
        ],
        warnings: [
          'Anomalias críticas aparecem em destaque — investigue imediatamente.',
        ],
      },
      {
        subtitle: 'Drill-Down de Dados',
        steps: [
          'Clique em qualquer número nas tabelas para ver detalhes.',
          'O modal de drill-down mostra a lista de registros.',
          'Cada registro tem link direto para o pipeline.',
          'Exporte a lista se necessário.',
        ],
      },
    ],
  },
  {
    id: 'whatsapp',
    title: '15. WhatsApp',
    icon: MessageSquare,
    description: 'Comunicação integrada via WhatsApp com clientes.',
    path: '/whatsapp',
    content: [
      {
        subtitle: 'Conectando o WhatsApp',
        steps: [
          'Acesse o módulo WhatsApp no menu lateral.',
          'Clique em "Conectar Instância" para adicionar um número.',
          'Escaneie o QR Code com o WhatsApp do celular.',
          'Aguarde a confirmação de conexão.',
          'Sua instância ficará ativa para envio e recebimento.',
        ],
        warnings: [
          'Use um número de WhatsApp comercial dedicado.',
          'Não desconecte o celular — mantenha conectado à internet.',
        ],
      },
      {
        subtitle: 'Lista de Conversas',
        steps: [
          'A tela principal mostra todas as conversas ativas.',
          'Conversas são ordenadas por última mensagem.',
          'Badge indica mensagens não lidas.',
          'Clique em uma conversa para abrir o chat.',
        ],
      },
      {
        subtitle: 'Enviando Mensagens',
        steps: [
          'Selecione uma conversa ou inicie nova pelo contato.',
          'Digite sua mensagem no campo inferior.',
          'Use Enter para enviar ou clique no botão.',
          'Mensagens enviadas aparecem à direita, recebidas à esquerda.',
        ],
      },
      {
        subtitle: 'Templates de Mensagem',
        steps: [
          'Use templates para mensagens frequentes.',
          'Clique no ícone de template ao lado do campo de texto.',
          'Selecione o template desejado.',
          'Personalize se necessário antes de enviar.',
        ],
        tips: [
          'Templates economizam tempo em mensagens repetitivas.',
          'Configure templates em Configurações > WhatsApp.',
        ],
      },
      {
        subtitle: 'Análise de Conversas',
        steps: [
          'A IA pode analisar o sentimento da conversa.',
          'Clique em "Analisar" no painel da conversa.',
          'Veja se o cliente está positivo, neutro ou negativo.',
          'Receba sugestões de como prosseguir.',
        ],
      },
      {
        subtitle: 'Métricas de WhatsApp',
        steps: [
          'Acesse a aba "Métricas" para ver estatísticas.',
          'Total de mensagens enviadas e recebidas.',
          'Tempo médio de resposta.',
          'Horários de pico de conversas.',
        ],
      },
    ],
  },
  {
    id: 'prospeccao',
    title: '16. Prospecção',
    icon: Globe,
    description: 'Busca e qualificação de novos leads e prospects.',
    path: '/prospecting',
    content: [
      {
        subtitle: 'Buscar Novos Leads',
        steps: [
          'Acesse o módulo Prospecção no menu lateral.',
          'Use os filtros para definir seu público-alvo.',
          'Filtros disponíveis: região, segmento, porte, etc.',
          'Clique em "Buscar" para encontrar empresas.',
        ],
      },
      {
        subtitle: 'Resultados da Busca',
        steps: [
          'Os resultados mostram empresas encontradas.',
          'Cada card exibe: razão social, CNPJ, localização, contato.',
          'Dados são consultados em fontes públicas.',
          'Clique em "Ver Detalhes" para mais informações.',
        ],
      },
      {
        subtitle: 'Importar para o CRM',
        steps: [
          'Ao encontrar um lead interessante, clique em "Importar".',
          'O sistema cria automaticamente a empresa no CRM.',
          'Dados são preenchidos conforme disponíveis.',
          'Você pode criar um negócio diretamente.',
        ],
        tips: [
          'Revise os dados importados antes de iniciar a abordagem.',
        ],
      },
      {
        subtitle: 'Histórico de Prospecção',
        steps: [
          'Veja o histórico de buscas realizadas.',
          'Leads já importados são sinalizados.',
          'Evite duplicar cadastros no sistema.',
          'Exporte resultados para análise externa.',
        ],
      },
    ],
  },
  {
    id: 'emails',
    title: '17. E-mails',
    icon: Mail,
    description: 'Envio de e-mails e campanhas para clientes.',
    path: '/emails',
    content: [
      {
        subtitle: 'Enviar E-mail Individual',
        steps: [
          'Acesse o módulo E-mails.',
          'Clique em "Novo E-mail".',
          'Selecione o destinatário (contato ou digite e-mail).',
          'Escolha um template ou escreva do zero.',
          'Preencha assunto e corpo da mensagem.',
          'Clique em "Enviar" ou agende para depois.',
        ],
      },
      {
        subtitle: 'Templates de E-mail',
        steps: [
          'Use templates para padronizar comunicações.',
          'Templates podem incluir variáveis ({nome}, {empresa}, etc.).',
          'Variáveis são substituídas automaticamente.',
          'Configure templates em Configurações.',
        ],
      },
      {
        subtitle: 'Agendar Envio',
        steps: [
          'Ao compor o e-mail, clique em "Agendar".',
          'Selecione data e hora de envio.',
          'E-mails agendados aparecem na fila.',
          'Você pode cancelar antes do envio.',
        ],
        tips: [
          'Agende e-mails para horários comerciais ideais.',
        ],
      },
      {
        subtitle: 'Rastreamento',
        steps: [
          'E-mails enviados são rastreados.',
          'Veja se o destinatário abriu o e-mail.',
          'Acompanhe cliques em links.',
          'Dados ajudam a identificar interesse.',
        ],
      },
    ],
  },
  {
    id: 'bots',
    title: '18. Bots e Automações',
    icon: Bot,
    description: 'Fluxos automatizados de atendimento via WhatsApp.',
    path: '/bots',
    content: [
      {
        subtitle: 'Visão Geral de Bots',
        steps: [
          'Bots automatizam conversas iniciais via WhatsApp.',
          'Podem coletar informações antes de transferir para humano.',
          'Funcionam 24/7 mesmo fora do horário comercial.',
          'Múltiplos fluxos podem ser criados para diferentes situações.',
        ],
      },
      {
        subtitle: 'Criar Novo Bot',
        steps: [
          'Clique em "Novo Bot".',
          'Defina nome e descrição do fluxo.',
          'Escolha o tipo de gatilho (mensagem inicial, palavra-chave, etc.).',
          'Configure a mensagem de boas-vindas.',
          'Clique em "Editar Fluxo" para construir as etapas.',
        ],
      },
      {
        subtitle: 'Editor Visual de Fluxos',
        steps: [
          'O editor usa blocos conectados por setas.',
          'Arraste blocos da barra lateral para a área de trabalho.',
          'Conecte blocos clicando e arrastando entre os pontos.',
          'Configure cada bloco clicando nele.',
        ],
      },
      {
        subtitle: 'Tipos de Blocos',
        steps: [
          'Mensagem: envia texto, imagem ou documento.',
          'Pergunta: coleta resposta do usuário.',
          'Condição: decide caminho baseado em resposta.',
          'Ação: executa ação no CRM (criar tarefa, negócio, etc.).',
          'Atraso: aguarda tempo antes de continuar.',
          'Transferir: passa para atendimento humano.',
        ],
      },
      {
        subtitle: 'Ativar/Desativar Bot',
        steps: [
          'Use o toggle para ativar ou desativar o bot.',
          'Bots inativos não respondem mensagens.',
          'Mantenha apenas bots necessários ativos.',
          'Teste antes de ativar em produção.',
        ],
        warnings: [
          'Bots mal configurados podem prejudicar a experiência do cliente.',
        ],
      },
    ],
  },
  {
    id: 'integracoes',
    title: '19. Integrações',
    icon: Zap,
    description: 'Conexões com sistemas externos (ERP Iniflex, Google Calendar, etc.).',
    path: '/integrations',
    content: [
      {
        subtitle: 'Integração Iniflex (ERP)',
        steps: [
          'A integração Iniflex conecta com o ERP da empresa.',
          'Sincroniza clientes, produtos e pedidos.',
          'Dados são atualizados periodicamente.',
          'Evita retrabalho de cadastro duplicado.',
        ],
      },
      {
        subtitle: 'Sincronizar Clientes',
        steps: [
          'Acesse Integrações > Iniflex > Clientes.',
          'Clique em "Sincronizar" para buscar clientes do ERP.',
          'Clientes novos são importados automaticamente.',
          'Clientes existentes são atualizados.',
        ],
      },
      {
        subtitle: 'Sincronizar Produtos',
        steps: [
          'Acesse Integrações > Iniflex > Produtos.',
          'Clique em "Sincronizar" para atualizar catálogo.',
          'Produtos sincronizados aparecem com badge "ERP".',
          'Preços podem vir do ERP ou ser sobrescritos.',
        ],
      },
      {
        subtitle: 'Google Calendar',
        steps: [
          'Conecte sua conta Google em Configurações.',
          'Tarefas com data aparecem no seu calendário.',
          'Eventos do Google aparecem no calendário de tarefas.',
          'Sincronização é bidirecional.',
        ],
        tips: [
          'Use para não perder compromissos em nenhuma ferramenta.',
        ],
      },
    ],
  },
  {
    id: 'configuracoes',
    title: '20. Configurações',
    icon: Settings,
    description: 'Configurações do sistema (administradores).',
    path: '/settings',
    adminOnly: true,
    content: [
      {
        subtitle: 'Campos Personalizados',
        steps: [
          'Crie campos extras para Empresas, Contatos ou Negócios.',
          'Tipos: Texto, Número, Data, Seleção, Checkbox, URL, Telefone, E-mail.',
          'Defina se o campo é obrigatório.',
          'Ordene os campos conforme preferência.',
        ],
      },
      {
        subtitle: 'Pipelines e Etapas',
        steps: [
          'Crie múltiplos pipelines para diferentes processos.',
          'Configure as etapas de cada pipeline.',
          'Defina cores, probabilidades e SLA por etapa.',
          'Ordene as etapas conforme o fluxo desejado.',
        ],
        warnings: [
          'Alterar etapas pode afetar negócios existentes.',
        ],
      },
      {
        subtitle: 'Checklist de Etapas',
        steps: [
          'Configure checklists obrigatórios por etapa.',
          'Itens podem ser obrigatórios ou opcionais.',
          'Vendedores devem completar antes de avançar.',
          'Garante que o processo seja seguido.',
        ],
      },
      {
        subtitle: 'Automações',
        steps: [
          'Crie regras automáticas baseadas em eventos.',
          'Gatilhos: mudança de etapa, criação de registro, etc.',
          'Ações: enviar e-mail, criar tarefa, notificar, etc.',
          'Ative ou desative automações conforme necessário.',
        ],
      },
      {
        subtitle: 'Permissões por Perfil',
        steps: [
          'Configure quais módulos cada perfil pode acessar.',
          'Perfis: Admin, Vendedor, Atendente (ou personalizados).',
          'Defina tipo de acesso: Restrito ou Total.',
          'Restrito: apenas dados próprios. Total: todos os dados.',
        ],
      },
      {
        subtitle: 'Gerenciar Usuários',
        steps: [
          'Visualize todos os usuários do sistema.',
          'Crie novos usuários informando e-mail e perfil.',
          'Edite dados ou altere o perfil de usuários existentes.',
          'Desative usuários que não devem mais acessar.',
        ],
      },
      {
        subtitle: 'Carteiras de Clientes',
        steps: [
          'Atribua empresas e contatos a vendedores específicos.',
          'Use a ferramenta de transferência para mover carteiras.',
          'Visualize o histórico de todas as transferências.',
          'Distribua leads de forma equilibrada.',
        ],
      },
      {
        subtitle: 'Metas de Vendas',
        steps: [
          'Configure metas por vendedor e período.',
          'Tipos de meta: valor, quantidade de negócios, atividades.',
          'Acompanhe o progresso no dashboard.',
          'Metas motivam e dão clareza de objetivos.',
        ],
      },
      {
        subtitle: 'Templates de WhatsApp',
        steps: [
          'Configure mensagens-padrão para WhatsApp.',
          'Use variáveis para personalização automática.',
          'Organize templates por categoria.',
          'Facilita respostas rápidas dos vendedores.',
        ],
      },
      {
        subtitle: 'Preferências de Notificação',
        steps: [
          'Configure quais alertas você deseja receber.',
          'E-mail diário de resumo: ative/desative.',
          'Alerta de tarefas: defina antecedência do lembrete.',
          'Alerta de negócios estagnados: configure dias.',
        ],
      },
      {
        subtitle: 'Dados de Teste',
        steps: [
          'Em ambiente de testes, gere dados fictícios.',
          'Útil para demonstrações e treinamentos.',
          'CUIDADO: não use em produção.',
        ],
        warnings: [
          'Dados de teste podem ser excluídos sem aviso.',
        ],
      },
    ],
  },
  {
    id: 'dicas',
    title: '21. Dicas e Boas Práticas',
    icon: TrendingUp,
    description: 'Recomendações para uso eficiente do sistema.',
    content: [
      {
        subtitle: 'Manter Dados Atualizados',
        steps: [
          'Atualize os status dos negócios imediatamente após reuniões.',
          'Mantenha contatos e empresas com dados corretos.',
          'Registre motivos de perda com informações detalhadas.',
          'Complete todos os campos obrigatórios.',
        ],
        tips: [
          'Dados atualizados geram relatórios mais precisos.',
          'O Copiloto IA funciona melhor com dados frescos.',
        ],
      },
      {
        subtitle: 'Registrar Atividades',
        steps: [
          'Documente todas as interações: reuniões, ligações, e-mails.',
          'Use notas para registrar informações importantes.',
          'Vincule atividades aos negócios correspondentes.',
          'O histórico ajuda na continuidade do relacionamento.',
        ],
        tips: [
          'Um bom histórico facilita a passagem de clientes entre vendedores.',
        ],
      },
      {
        subtitle: 'Usar o Copiloto',
        steps: [
          'Consulte o Copiloto regularmente para sugestões.',
          'Aceite sugestões relevantes para agilizar seu trabalho.',
          'Descarte sugestões que não se aplicam.',
          'O Copiloto aprende com suas escolhas.',
        ],
      },
      {
        subtitle: 'Organizar Tarefas',
        steps: [
          'Crie tarefas para todos os follow-ups necessários.',
          'Use prioridades corretamente.',
          'Conclua tarefas assim que finalizadas.',
          'Não deixe tarefas atrasadas se acumularem.',
        ],
      },
      {
        subtitle: 'Revisar Pipeline Diariamente',
        steps: [
          'Reserve 15 minutos no início do dia para revisar o pipeline.',
          'Identifique negócios que precisam de ação.',
          'Mova negócios estagnados ou tome uma decisão.',
          'Mantenha o funil limpo e realista.',
        ],
      },
      {
        subtitle: 'Usar Filtros e Busca',
        steps: [
          'Aprenda a usar os filtros avançados.',
          'Combine filtros para análises específicas.',
          'Use a busca global para encontrar registros rapidamente.',
          'Exporte dados filtrados quando necessário.',
        ],
      },
    ],
  },
  {
    id: 'seguranca',
    title: '22. Segurança e Privacidade',
    icon: Shield,
    description: 'Práticas de segurança e proteção de dados.',
    content: [
      {
        subtitle: 'Proteja sua Senha',
        steps: [
          'Use senhas fortes com letras, números e símbolos.',
          'Não compartilhe sua senha com ninguém.',
          'Altere sua senha periodicamente.',
          'Não use a mesma senha de outros serviços.',
        ],
      },
      {
        subtitle: 'Encerrar Sessão',
        steps: [
          'Sempre clique em "Sair" ao terminar o trabalho.',
          'Especialmente importante em computadores compartilhados.',
          'Sessões inativas são encerradas automaticamente após tempo.',
        ],
      },
      {
        subtitle: 'Dados Sensíveis',
        steps: [
          'Não exporte dados sem necessidade.',
          'Cuidado ao compartilhar telas em reuniões.',
          'Dados de clientes são confidenciais.',
          'Respeite a LGPD e políticas da empresa.',
        ],
        warnings: [
          'Vazamento de dados pode ter consequências legais graves.',
        ],
      },
      {
        subtitle: 'Auditoria',
        steps: [
          'Todas as ações são registradas no sistema.',
          'Administradores podem ver logs de auditoria.',
          'Tentativas de acesso indevido são registradas.',
          'Mantenha conduta ética no uso do sistema.',
        ],
      },
    ],
  },
];

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('todos');

  const filteredSections = useMemo(() => {
    let sections = helpSections;
    
    // Filter by tab
    if (activeTab === 'vendas') {
      sections = sections.filter(s => ['pipeline', 'empresas', 'contatos', 'produtos', 'precos', 'pedidos', 'prospeccao'].includes(s.id));
    } else if (activeTab === 'produtividade') {
      sections = sections.filter(s => ['hoje', 'tarefas', 'insights', 'copiloto', 'emails'].includes(s.id));
    } else if (activeTab === 'comunicacao') {
      sections = sections.filter(s => ['whatsapp', 'bots', 'emails'].includes(s.id));
    } else if (activeTab === 'analise') {
      sections = sections.filter(s => ['dashboard', 'relatorios', 'bi-avancado'].includes(s.id));
    } else if (activeTab === 'admin') {
      sections = sections.filter(s => ['configuracoes', 'integracoes'].includes(s.id));
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      sections = sections.filter(section => {
        const matchesTitle = section.title.toLowerCase().includes(query);
        const matchesDescription = section.description.toLowerCase().includes(query);
        const matchesContent = section.content.some(
          item => 
            item.subtitle.toLowerCase().includes(query) ||
            item.steps?.some(step => step.toLowerCase().includes(query)) ||
            item.tips?.some(tip => tip.toLowerCase().includes(query))
        );
        return matchesTitle || matchesDescription || matchesContent;
      });
    }
    
    return sections;
  }, [searchQuery, activeTab]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrintPDF = () => {
    toast.info('Preparando documento para impressão...');
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Erro ao abrir janela de impressão. Verifique as permissões do navegador.');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Manual do Usuário - CRMPro</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto;
          }
          .cover { text-align: center; padding: 80px 20px; border-bottom: 3px solid #3b82f6; margin-bottom: 40px; page-break-after: always; }
          .cover h1 { font-size: 36px; color: #1e40af; margin-bottom: 16px; }
          .cover p { font-size: 18px; color: #64748b; }
          .cover .version { margin-top: 40px; font-size: 14px; color: #94a3b8; }
          .toc { margin-bottom: 40px; page-break-after: always; }
          .toc h2 { font-size: 24px; margin-bottom: 20px; color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          .toc ul { list-style: none; }
          .toc li { padding: 8px 0; border-bottom: 1px dotted #e2e8f0; }
          .section { margin-bottom: 40px; page-break-inside: avoid; }
          .section-header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; }
          .section-header h2 { font-size: 20px; margin-bottom: 4px; }
          .section-header p { font-size: 14px; opacity: 0.9; }
          .admin-badge { display: inline-block; background: #fbbf24; color: #78350f; font-size: 10px; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: 600; }
          .subsection { margin-bottom: 24px; padding-left: 16px; border-left: 3px solid #e2e8f0; }
          .subsection h3 { font-size: 16px; color: #334155; margin-bottom: 12px; }
          .steps { margin: 0; padding-left: 0; list-style: none; }
          .steps li { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; font-size: 14px; }
          .step-number { flex-shrink: 0; width: 24px; height: 24px; background: #dbeafe; color: #1e40af; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; }
          .tip { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 12px 16px; margin-top: 12px; font-size: 13px; }
          .tip::before { content: '💡 Dica: '; font-weight: 600; color: #166534; }
          .warning { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 12px 16px; margin-top: 12px; font-size: 13px; }
          .warning::before { content: '⚠️ Atenção: '; font-weight: 600; color: #dc2626; }
          .footer { margin-top: 60px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
          @media print { body { padding: 20px; } .section { page-break-inside: avoid; } .cover, .toc { page-break-after: always; } }
        </style>
      </head>
      <body>
        <div class="cover">
          <h1>📖 Manual do Usuário</h1>
          <p>CRMPro - Sistema de Gestão de Relacionamento com Clientes</p>
          <div class="version">Versão 2.0 • Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
        <div class="toc">
          <h2>Índice</h2>
          <ul>${helpSections.map(section => `<li>${section.title}${section.adminOnly ? ' <span class="admin-badge">Admin</span>' : ''}</li>`).join('')}</ul>
        </div>
        ${helpSections.map(section => `
          <div class="section">
            <div class="section-header">
              <h2>${section.title}${section.adminOnly ? ' <span class="admin-badge">Admin</span>' : ''}</h2>
              <p>${section.description}</p>
            </div>
            ${section.content.map(item => `
              <div class="subsection">
                <h3>${item.subtitle}</h3>
                ${item.steps?.length ? `<ol class="steps">${item.steps.map((step, idx) => `<li><span class="step-number">${idx + 1}</span><span>${step}</span></li>`).join('')}</ol>` : ''}
                ${item.tips?.map(tip => `<div class="tip">${tip}</div>`).join('') || ''}
                ${item.warnings?.map(warning => `<div class="warning">${warning}</div>`).join('') || ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
        <div class="footer">
          <p>CRMPro - Manual do Usuário</p>
          <p>© ${new Date().getFullYear()} - Todos os direitos reservados</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        toast.success('Documento pronto para impressão/download!');
      }, 250);
    };
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-4rem)]">
      {/* Sidebar Navigation */}
      <aside className="lg:w-80 shrink-0">
        <Card className="lg:sticky lg:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Manual do Usuário
            </CardTitle>
            <CardDescription>
              Guia completo do CRMPro v2.0
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar no manual..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'vendas', label: 'Vendas' },
                { id: 'produtividade', label: 'Produtividade' },
                { id: 'comunicacao', label: 'Comunicação' },
                { id: 'analise', label: 'Análise' },
                { id: 'admin', label: 'Admin' },
              ].map(tab => (
                <Badge
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </Badge>
              ))}
            </div>

            {/* Section List */}
            <ScrollArea className="h-[45vh] lg:h-[55vh]">
              <nav className="space-y-1 pr-4">
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left",
                      activeSection === section.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <section.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate text-xs">{section.title}</span>
                    {section.adminOnly && (
                      <Badge variant="secondary" className="ml-auto text-[10px] px-1 shrink-0">
                        Admin
                      </Badge>
                    )}
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </CardContent>
        </Card>
      </aside>

      {/* Main Content */}
      <main className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Central de Ajuda</h1>
            <p className="text-muted-foreground">
              Encontre instruções detalhadas para todas as funcionalidades do CRMPro.
            </p>
          </div>
          <Button onClick={handlePrintPDF} className="shrink-0">
            <Download className="mr-2 h-4 w-4" />
            Baixar PDF
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{helpSections.length}</p>
                <p className="text-xs text-muted-foreground">Seções</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckSquare className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{helpSections.reduce((acc, s) => acc + s.content.length, 0)}</p>
                <p className="text-xs text-muted-foreground">Tópicos</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Lightbulb className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{helpSections.reduce((acc, s) => acc + s.content.reduce((a, c) => a + (c.tips?.length || 0), 0), 0)}</p>
                <p className="text-xs text-muted-foreground">Dicas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Shield className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{helpSections.reduce((acc, s) => acc + s.content.reduce((a, c) => a + (c.warnings?.length || 0), 0), 0)}</p>
                <p className="text-xs text-muted-foreground">Avisos</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sections */}
        {filteredSections.length === 0 ? (
          <Card className="p-8 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum resultado encontrado</h3>
            <p className="text-muted-foreground">
              Tente buscar por outras palavras-chave ou limpe os filtros.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => { setSearchQuery(''); setActiveTab('todos'); }}>
              Limpar Filtros
            </Button>
          </Card>
        ) : (
          filteredSections.map((section) => (
            <Card key={section.id} id={section.id} className="scroll-mt-6">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <section.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        {section.title}
                        {section.adminOnly && (
                          <Badge variant="secondary">Apenas Admin</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {section.description}
                      </CardDescription>
                    </div>
                  </div>
                  {section.path && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={section.path}>
                        Ir para módulo
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {section.content.map((item, idx) => (
                    <AccordionItem key={idx} value={`${section.id}-${idx}`}>
                      <AccordionTrigger className="text-left hover:no-underline">
                        <span className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium">{item.subtitle}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-2">
                        {/* Steps */}
                        {item.steps && item.steps.length > 0 && (
                          <ol className="space-y-2">
                            {item.steps.map((step, stepIdx) => (
                              <li key={stepIdx} className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                                  {stepIdx + 1}
                                </span>
                                <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {/* Tips */}
                        {item.tips && item.tips.length > 0 && (
                          <div className="space-y-2">
                            {item.tips.map((tip, tipIdx) => (
                              <div key={tipIdx} className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                <Lightbulb className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                                <span className="text-sm text-green-700 dark:text-green-400">{tip}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Warnings */}
                        {item.warnings && item.warnings.length > 0 && (
                          <div className="space-y-2">
                            {item.warnings.map((warning, warnIdx) => (
                              <div key={warnIdx} className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                <Shield className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                <span className="text-sm text-destructive">{warning}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
