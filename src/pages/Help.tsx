import { useState, useMemo } from 'react';
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
  MousePointer,
  RefreshCw,
  ArrowRight,
  GripVertical,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
    description: 'Introdução ao sistema, login e navegação básica.',
    content: [
      {
        subtitle: 'Login e Autenticação',
        steps: [
          'Acesse o sistema pelo endereço fornecido pelo administrador.',
          'Insira seu e-mail e senha cadastrados.',
          'Clique em "Entrar" para acessar o sistema.',
          'Caso seja seu primeiro acesso, utilize a opção "Criar conta" com o e-mail autorizado.',
        ],
        tips: ['Mantenha suas credenciais em local seguro.', 'Ao finalizar o trabalho, utilize o botão "Sair" para encerrar sua sessão.'],
      },
      {
        subtitle: 'Navegação pelo Sistema',
        steps: [
          'O menu lateral esquerdo contém todos os módulos disponíveis.',
          'Clique em qualquer item do menu para acessar o módulo.',
          'No mobile, toque no ícone de menu (☰) para abrir a navegação.',
          'O módulo atual fica destacado no menu.',
        ],
        tips: ['Use o botão de colapsar (←) para minimizar o menu e ter mais espaço de trabalho.'],
      },
      {
        subtitle: 'Botão Atualizar Dados',
        steps: [
          'Em diversas telas você encontrará um botão "Atualizar" com ícone de refresh.',
          'Utilize-o para recarregar os dados da tela atual.',
          'Útil quando outros usuários fizeram alterações recentes.',
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    title: '2. Visão Geral (Dashboard)',
    icon: LayoutDashboard,
    description: 'Painel principal com métricas e insights do negócio.',
    path: '/dashboard',
    content: [
      {
        subtitle: 'Cards de Estatísticas',
        steps: [
          'Os cards no topo mostram métricas importantes em tempo real.',
          'Valores como total de negócios, conversões e receita são atualizados automaticamente.',
          'Clique em um card para ver detalhes ou ir para o módulo relacionado.',
        ],
      },
      {
        subtitle: 'Widgets Personalizáveis',
        steps: [
          'O dashboard possui widgets que exibem gráficos e tabelas.',
          'Cada widget pode mostrar dados diferentes conforme configuração.',
          'Utilize filtros de data para ajustar o período analisado.',
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
        tips: ['Cada usuário pode ter seu próprio layout de dashboard.'],
      },
    ],
  },
  {
    id: 'pipeline',
    title: '3. Pipeline de Vendas',
    icon: Target,
    description: 'Gestão de oportunidades de negócio através de etapas.',
    path: '/pipeline',
    content: [
      {
        subtitle: 'Visão Kanban vs Lista',
        steps: [
          'Use os botões no topo para alternar entre visualização Kanban e Lista.',
          'Kanban: cards organizados em colunas por etapa (arraste para mover).',
          'Lista: tabela ordenável com todas as informações em uma linha.',
        ],
        tips: ['Kanban é ideal para visão geral, Lista para análise detalhada.'],
      },
      {
        subtitle: 'Criar Novo Negócio',
        steps: [
          'Clique no botão "Novo Negócio" no canto superior direito.',
          'Preencha os campos obrigatórios: Nome e Valor.',
          'Selecione a Empresa e Contato relacionados.',
          'Defina a Data Prevista de fechamento.',
          'Clique em "Criar" para salvar.',
        ],
      },
      {
        subtitle: 'Mover entre Etapas (Kanban)',
        steps: [
          'Clique e segure no card do negócio.',
          'Arraste para a coluna da etapa desejada.',
          'Solte o card para confirmar a mudança.',
        ],
        warnings: ['Ao mover para "Fechado (Perdido)", você deverá informar o motivo da perda.'],
      },
      {
        subtitle: 'Editar Negócio',
        steps: [
          'Clique no card ou linha do negócio para abrir o painel de edição.',
          'Aba "Dados": informações gerais e campos personalizados.',
          'Aba "Propostas": criar e gerenciar propostas comerciais.',
          'Aba "Equipe": adicionar participantes ao negócio.',
          'Aba "Histórico": visualizar todas as alterações.',
        ],
      },
      {
        subtitle: 'Filtros Avançados',
        steps: [
          'Use os filtros acima do pipeline para refinar a visualização.',
          'Filtrar por Responsável: "Meus negócios" ou selecione um vendedor.',
          'Filtrar por Etapa: visualize apenas uma etapa específica.',
          'Filtrar por Empresa: veja negócios de um cliente específico.',
        ],
      },
    ],
  },
  {
    id: 'empresas',
    title: '4. Empresas',
    icon: Building2,
    description: 'Cadastro e gestão de empresas clientes.',
    path: '/companies',
    content: [
      {
        subtitle: 'Cadastrar Nova Empresa',
        steps: [
          'Clique em "Nova Empresa".',
          'Preencha a Razão Social (obrigatório).',
          'Informe CNPJ, Nome Fantasia e Inscrição Estadual.',
          'Complete com endereço, telefone e e-mail.',
          'Clique em "Salvar" para criar a empresa.',
        ],
      },
      {
        subtitle: 'Visualizar Negócios Vinculados',
        steps: [
          'A coluna "Funil" na tabela mostra quantos negócios a empresa possui.',
          'Clique no número para ver os detalhes dos negócios.',
          'Cores indicam o status: verde (ganho), vermelho (perdido), azul (em andamento).',
        ],
      },
      {
        subtitle: 'Tabela de Preços da Empresa',
        steps: [
          'Ao editar uma empresa, veja a seção "Tabela de Preços".',
          'Empresas podem ter tabelas de preços específicas.',
          'Ao criar propostas, o sistema aplicará automaticamente os descontos configurados.',
        ],
        tips: ['Configure tabelas de preços no módulo "Tabelas de Preços".'],
      },
    ],
  },
  {
    id: 'contatos',
    title: '5. Contatos',
    icon: Users,
    description: 'Cadastro de pessoas de contato.',
    path: '/contacts',
    content: [
      {
        subtitle: 'Cadastrar Novo Contato',
        steps: [
          'Clique em "Novo Contato".',
          'Preencha Nome (obrigatório), Sobrenome e E-mail.',
          'Informe telefone e celular para comunicação.',
          'Defina o cargo e departamento.',
        ],
      },
      {
        subtitle: 'Vincular a Empresa',
        steps: [
          'No campo "Empresa", selecione a empresa à qual o contato pertence.',
          'Um contato pode pertencer a apenas uma empresa.',
          'Contatos sem empresa ficam como "Pessoa Física".',
        ],
      },
      {
        subtitle: 'CPF e Tipo de Pessoa',
        steps: [
          'Selecione o tipo: PF (Pessoa Física) ou PJ (Pessoa Jurídica).',
          'Para PF, informe o CPF do contato.',
          'O sistema valida automaticamente o formato do CPF.',
        ],
      },
      {
        subtitle: 'Acessar WhatsApp do Contato',
        steps: [
          'Clique no ícone do WhatsApp ao lado do celular.',
          'O sistema abrirá a conversa diretamente no módulo WhatsApp.',
          'Você poderá ver histórico e enviar mensagens.',
        ],
        tips: ['Certifique-se de que o celular está no formato correto com DDD.'],
      },
    ],
  },
  {
    id: 'produtos',
    title: '6. Produtos',
    icon: Package,
    description: 'Catálogo de produtos com especificações técnicas.',
    path: '/products',
    content: [
      {
        subtitle: 'Cadastrar Produto',
        steps: [
          'Clique em "Novo Produto".',
          'Informe o SKU (código único obrigatório).',
          'Preencha o Nome e Descrição do produto.',
          'Selecione a Categoria.',
          'Defina o Preço Unitário base.',
        ],
      },
      {
        subtitle: 'Especificações Técnicas',
        steps: [
          'Informe as dimensões: Largura, Comprimento e Espessura.',
          'Selecione o Material (ex: Aço, Alumínio, Plástico).',
          'Escolha a Cor do produto.',
          'Defina a unidade de medida (un, kg, m², etc.).',
        ],
        tips: ['Medidas são importantes para cálculos automáticos em propostas.'],
      },
      {
        subtitle: 'Filtros e Status',
        steps: [
          'Use os filtros para encontrar produtos por categoria ou status.',
          'Toggle "Ativo/Inativo" controla se o produto aparece em propostas.',
          'Produtos inativos ficam ocultos nas seleções, mas mantêm histórico.',
        ],
      },
    ],
  },
  {
    id: 'precos',
    title: '7. Tabelas de Preços',
    icon: DollarSign,
    description: 'Configuração de políticas de preços e descontos.',
    path: '/pricing',
    content: [
      {
        subtitle: 'Criar Nova Tabela',
        steps: [
          'Clique em "Nova Tabela de Preços".',
          'Defina um nome identificador (ex: "Preço Distribuidor").',
          'Adicione uma descrição opcional.',
          'Marque se é a tabela padrão do sistema.',
        ],
      },
      {
        subtitle: 'Definir Regras de Desconto',
        steps: [
          'Na aba "Regras", adicione as condições de preço.',
          'Defina desconto por quantidade mínima.',
          'Configure preço fixo para produtos específicos.',
          'Organize a prioridade das regras (ordem de aplicação).',
        ],
        tips: ['Regras mais específicas devem ter maior prioridade.'],
      },
      {
        subtitle: 'Vincular a Clientes',
        steps: [
          'Na aba "Vínculos", associe a tabela a empresas ou contatos.',
          'Clientes vinculados terão os preços aplicados automaticamente.',
          'Um cliente pode ter apenas uma tabela ativa.',
        ],
      },
      {
        subtitle: 'Validade da Tabela',
        steps: [
          'Defina as datas de início e fim de validade.',
          'Tabelas expiradas ficam inativas automaticamente.',
          'Você receberá alertas sobre tabelas próximas do vencimento.',
        ],
      },
    ],
  },
  {
    id: 'pedidos',
    title: '8. Pedidos',
    icon: ShoppingCart,
    description: 'Gestão de pedidos de venda.',
    path: '/orders',
    content: [
      {
        subtitle: 'Criar Pedido Manual',
        steps: [
          'Clique em "Novo Pedido".',
          'Selecione a Empresa e o Contato.',
          'Adicione os itens do pedido com quantidade e preço.',
          'Revise o valor total e confirme.',
        ],
      },
      {
        subtitle: 'Pedido via Proposta Aprovada',
        steps: [
          'Quando uma proposta é aprovada pelo cliente, um pedido é criado automaticamente.',
          'O pedido herda todos os itens e condições da proposta.',
          'Você pode editar o pedido se necessário antes de processar.',
        ],
        tips: ['Propostas aprovadas são a forma mais segura de gerar pedidos.'],
      },
      {
        subtitle: 'Status do Pedido',
        steps: [
          'Pendente: aguardando processamento.',
          'Em Produção: pedido em fabricação.',
          'Produzido: pronto para faturamento.',
          'Faturado: nota fiscal emitida.',
          'Entregue: pedido entregue ao cliente.',
          'Cancelado: pedido cancelado.',
        ],
      },
      {
        subtitle: 'Histórico de Alterações',
        steps: [
          'Clique no pedido para ver detalhes.',
          'A aba "Histórico" mostra todas as alterações realizadas.',
          'Cada alteração registra data, usuário e valores antigo/novo.',
        ],
      },
    ],
  },
  {
    id: 'tarefas',
    title: '9. Tarefas',
    icon: CheckSquare,
    description: 'Gestão de atividades e compromissos.',
    path: '/tasks',
    content: [
      {
        subtitle: 'Criar Nova Tarefa',
        steps: [
          'Clique em "Nova Tarefa".',
          'Defina o título da tarefa (obrigatório).',
          'Adicione uma descrição detalhada.',
          'Selecione a data e hora de vencimento.',
        ],
      },
      {
        subtitle: 'Prioridades',
        steps: [
          'Baixa: tarefas sem urgência.',
          'Média: importância normal.',
          'Alta: requer atenção prioritária.',
          'Urgente: ação imediata necessária.',
        ],
        tips: ['Tarefas urgentes aparecem destacadas em vermelho.'],
      },
      {
        subtitle: 'Vincular a Entidades',
        steps: [
          'Associe a tarefa a uma Empresa para tarefas gerais do cliente.',
          'Vincule a um Contato para follow-ups específicos.',
          'Relacione a um Negócio para ações do pipeline.',
        ],
      },
      {
        subtitle: 'Concluir Tarefas',
        steps: [
          'Clique no checkbox ao lado da tarefa para marcá-la como concluída.',
          'Tarefas concluídas podem ser visualizadas no filtro "Concluídas".',
          'A data de conclusão é registrada automaticamente.',
        ],
      },
      {
        subtitle: 'Filtros',
        steps: [
          'Pendentes: tarefas ainda não concluídas.',
          'Atrasadas: tarefas com data de vencimento ultrapassada.',
          'Concluídas: tarefas já finalizadas.',
          'Minhas Tarefas: apenas tarefas atribuídas a você.',
        ],
      },
    ],
  },
  {
    id: 'relatorios',
    title: '10. Relatórios',
    icon: BarChart3,
    description: 'Análises e métricas de desempenho.',
    path: '/reports',
    content: [
      {
        subtitle: 'Funil de Vendas',
        steps: [
          'Visualize a distribuição de negócios por etapa.',
          'O gráfico mostra quantidade e valor em cada fase.',
          'Compare a taxa de conversão entre etapas.',
        ],
      },
      {
        subtitle: 'Velocidade do Pipeline',
        steps: [
          'Analise o tempo médio em cada etapa.',
          'Identifique gargalos no processo de vendas.',
          'Compare o desempenho entre períodos.',
        ],
      },
      {
        subtitle: 'Motivos de Perda',
        steps: [
          'Veja os principais motivos de negócios perdidos.',
          'O gráfico de pizza mostra a distribuição percentual.',
          'Use essas informações para melhorar sua abordagem.',
        ],
        tips: ['Registrar motivos de perda corretamente melhora a análise.'],
      },
      {
        subtitle: 'Exportar Relatório',
        steps: [
          'Clique no botão "Imprimir/PDF" para exportar.',
          'Selecione as seções que deseja incluir.',
          'O relatório será gerado em formato PDF.',
        ],
      },
    ],
  },
  {
    id: 'configuracoes',
    title: '11. Configurações',
    icon: Settings,
    description: 'Configurações do sistema (apenas administradores).',
    path: '/settings',
    adminOnly: true,
    content: [
      {
        subtitle: 'Campos Personalizados',
        steps: [
          'Crie campos extras para Empresas, Contatos ou Negócios.',
          'Tipos disponíveis: Texto, Número, Data, Seleção, Checkbox, URL, etc.',
          'Campos obrigatórios impedem o salvamento sem preenchimento.',
        ],
      },
      {
        subtitle: 'Etapas do Pipeline',
        steps: [
          'Configure as etapas do seu funil de vendas.',
          'Defina cores e probabilidades para cada etapa.',
          'A ordem das etapas reflete o fluxo do negócio.',
        ],
        warnings: ['Alterar etapas afeta negócios existentes.'],
      },
      {
        subtitle: 'Automações',
        steps: [
          'Crie regras automáticas baseadas em eventos.',
          'Exemplos: enviar e-mail ao mudar etapa, criar tarefa automática.',
          'Ative ou desative automações conforme necessário.',
        ],
      },
      {
        subtitle: 'Permissões por Perfil',
        steps: [
          'Configure quais módulos cada perfil pode acessar.',
          'Perfis: Admin (acesso total), Vendedor, Atendente.',
          'Defina se o acesso é restrito (próprios dados) ou total.',
        ],
      },
      {
        subtitle: 'Gerenciar Usuários',
        steps: [
          'Visualize todos os usuários do sistema.',
          'Crie novos usuários com e-mail e perfil.',
          'Edite ou desative usuários existentes.',
        ],
      },
      {
        subtitle: 'Carteiras de Clientes',
        steps: [
          'Atribua empresas e contatos a vendedores específicos.',
          'Transfira carteiras entre usuários.',
          'Visualize o histórico de transferências.',
        ],
      },
    ],
  },
  {
    id: 'dicas',
    title: '12. Dicas e Boas Práticas',
    icon: Lightbulb,
    description: 'Recomendações para uso eficiente do sistema.',
    content: [
      {
        subtitle: 'Manter Dados Atualizados',
        steps: [
          'Atualize os status dos negócios regularmente.',
          'Mantenha contatos e empresas com dados corretos.',
          'Registre motivos de perda com informações detalhadas.',
        ],
        tips: ['Dados atualizados geram relatórios mais precisos.'],
      },
      {
        subtitle: 'Usar o Botão Atualizar',
        steps: [
          'Clique em "Atualizar" quando outros usuários fizeram alterações.',
          'O sistema não atualiza automaticamente em tempo real.',
          'Use regularmente em ambientes com múltiplos usuários.',
        ],
      },
      {
        subtitle: 'Registrar Atividades no Histórico',
        steps: [
          'Documente reuniões, ligações e e-mails importantes.',
          'Use notas para registrar informações relevantes.',
          'O histórico ajuda a dar continuidade no relacionamento.',
        ],
        tips: ['Um bom histórico facilita a passagem de clientes entre vendedores.'],
      },
      {
        subtitle: 'Organizar Tarefas',
        steps: [
          'Crie tarefas para todos os follow-ups necessários.',
          'Use prioridades para organizar seu dia.',
          'Conclua tarefas assim que finalizadas para manter o controle.',
        ],
      },
    ],
  },
];

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return helpSections;
    
    const query = searchQuery.toLowerCase();
    return helpSections.filter(section => {
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
  }, [searchQuery]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-[calc(100vh-4rem)]">
      {/* Sidebar Navigation */}
      <aside className="lg:w-72 shrink-0">
        <Card className="lg:sticky lg:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Manual do Usuário
            </CardTitle>
            <CardDescription>
              Guia completo do CRMPro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Section List */}
            <ScrollArea className="h-[50vh] lg:h-[60vh]">
              <nav className="space-y-1 pr-4">
                {helpSections.map((section) => (
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
                    <span className="truncate">{section.title}</span>
                    {section.adminOnly && (
                      <Badge variant="outline" className="ml-auto text-xs shrink-0">
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
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Central de Ajuda</h1>
          <p className="text-muted-foreground">
            Encontre instruções detalhadas para todas as funcionalidades do CRMPro.
          </p>
        </div>

        {/* Sections */}
        {filteredSections.length === 0 ? (
          <Card className="p-8 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum resultado encontrado</h3>
            <p className="text-muted-foreground">
              Tente buscar por outras palavras-chave.
            </p>
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
                      <AccordionTrigger className="text-left">
                        <span className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4 text-primary" />
                          {item.subtitle}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pl-6 space-y-4">
                        {/* Steps */}
                        {item.steps && item.steps.length > 0 && (
                          <ol className="space-y-2">
                            {item.steps.map((step, stepIdx) => (
                              <li key={stepIdx} className="flex items-start gap-3">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
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
                              <div
                                key={tipIdx}
                                className="flex items-start gap-2 p-3 rounded-lg bg-accent border border-border"
                              >
                                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <span className="text-sm text-accent-foreground">{tip}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Warnings */}
                        {item.warnings && item.warnings.length > 0 && (
                          <div className="space-y-2">
                            {item.warnings.map((warning, warnIdx) => (
                              <div
                                key={warnIdx}
                                className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                              >
                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
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

        {/* Footer */}
        <Card className="bg-muted/50">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-medium">Precisa de mais ajuda?</h3>
                  <p className="text-sm text-muted-foreground">
                    Entre em contato com o suporte técnico.
                  </p>
                </div>
              </div>
              <Button variant="outline">
                Contatar Suporte
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
