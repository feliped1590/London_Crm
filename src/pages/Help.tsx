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
          'Após confirmação, faça login normalmente com e-mail e senha.',
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
          'O menu pode ser recolhido clicando na seta no topo — mostrando apenas ícones.',
        ],
        tips: [
          'O menu se adapta às suas permissões — você só verá os módulos autorizados.',
          'Use atalhos de teclado: Ctrl+K para abrir a busca global.',
          'No WhatsApp, o menu mostra badge com contagem de mensagens não lidas.',
        ],
      },
      {
        subtitle: 'Entendendo os Perfis de Acesso',
        steps: [
          'Administrador: acesso total a todos os módulos e configurações do sistema.',
          'Vendedor: acesso ao pipeline, clientes, tarefas e módulos de vendas (dados próprios ou da equipe).',
          'Atendente: acesso focado em atendimento, WhatsApp e suporte ao cliente.',
          'Desenvolvedor: acesso especial a integrações e configurações técnicas.',
          'Cada perfil pode ter acesso "Total" ou "Restrito" por módulo.',
          'Acesso Restrito significa que você só visualiza dados atribuídos a você (seus clientes, seus negócios).',
        ],
        warnings: [
          'Tentativas de acessar dados não autorizados são registradas automaticamente no log de violações.',
          'Administradores podem ver o log de tentativas de acesso indevido em Configurações > Intervenções.',
        ],
      },
      {
        subtitle: 'Busca Global',
        steps: [
          'A barra de busca no topo permite encontrar qualquer registro do sistema.',
          'Digite o nome de uma empresa, contato, negócio ou tarefa.',
          'Os resultados são categorizados por tipo (Empresa, Contato, Negócio, Tarefa).',
          'Clique no resultado para ir diretamente ao registro.',
          'Resultados respeitam suas permissões de acesso.',
        ],
        tips: [
          'Use a busca para encontrar rapidamente um cliente antes de uma ligação.',
          'A busca considera razão social, nome fantasia, CNPJ e nome de contatos.',
          'Atalho: Ctrl+K abre a busca global instantaneamente.',
        ],
      },
      {
        subtitle: 'Seletor de Entidade Jurídica (Multi-CNPJ)',
        steps: [
          'No topo da tela, o seletor de entidade jurídica permite alternar entre CNPJs da empresa.',
          'Cada entidade jurídica tem seus próprios negócios, pedidos e relatórios.',
          'Selecione a entidade para filtrar todos os dados do sistema.',
          'A opção "Todas" mostra dados consolidados (se permitido pelo seu perfil).',
        ],
        tips: [
          'Se você trabalha com apenas um CNPJ, o seletor não aparece.',
          'Administradores configuram quais entidades cada usuário pode acessar.',
        ],
      },
      {
        subtitle: 'Perfil do Usuário',
        steps: [
          'Clique no seu avatar/e-mail no rodapé do menu lateral.',
          'Visualize e edite seu nome completo e telefone.',
          'Altere sua foto de perfil.',
          'Veja suas permissões e entidades jurídicas vinculadas.',
        ],
      },
    ],
  },
  {
    id: 'hoje',
    title: '2. Meu Dia (Hoje)',
    icon: Calendar,
    description: 'Visão consolidada das atividades do dia, prioridades e resumo de performance.',
    path: '/today',
    content: [
      {
        subtitle: 'Visão Geral do Dia',
        steps: [
          'Acesse o módulo "Meu Dia" no menu lateral — é a página inicial do sistema.',
          'A tela possui duas abas: "Meu Dia" (operacional) e "Visão Geral" (analítico/dashboard).',
          'Na aba "Meu Dia", veja um resumo diário com 4 cards principais:',
          'Card "Pipeline": valor total dos negócios em aberto.',
          'Card "Metas": progresso percentual das suas metas de vendas.',
          'Card "Fechados": negócios ganhos no mês corrente.',
          'Card "Atrasadas": quantidade de tarefas vencidas.',
        ],
        tips: [
          'Comece seu dia sempre por esta tela para ter clareza das prioridades.',
          'Os cards são calculados em tempo real a partir dos dados do sistema.',
        ],
      },
      {
        subtitle: 'Tarefas do Dia',
        steps: [
          'A lista mostra todas as tarefas com vencimento para hoje, ordenadas por prioridade.',
          'Tarefas urgentes aparecem no topo com destaque vermelho.',
          'Clique no checkbox para marcar uma tarefa como concluída.',
          'Clique na tarefa para ver detalhes, editar ou reagendar.',
          'Tarefas atrasadas (de dias anteriores) também aparecem destacadas.',
          'Badge de cor indica prioridade: cinza (baixa), azul (média), laranja (alta), vermelho (urgente).',
        ],
      },
      {
        subtitle: 'Negócios Estagnados',
        steps: [
          'O card "Negócios Estagnados" mostra oportunidades paradas há mais de 5 dias sem atualização.',
          'Cada negócio exibe há quantos dias está sem movimentação.',
          'A etapa atual e o valor são exibidos para priorização.',
          'Clique no negócio para acessar o pipeline e tomar uma ação.',
        ],
        warnings: [
          'Negócios estagnados prejudicam sua taxa de conversão e indicadores de SLA.',
          'Tome uma ação: agende tarefa, envie WhatsApp ou atualize o status.',
        ],
      },
      {
        subtitle: 'Aba "Visão Geral" (Dashboard)',
        steps: [
          'Clique na aba "Visão Geral" para acessar o dashboard analítico.',
          'Visualize widgets personalizáveis com métricas do negócio.',
          'Arraste widgets para reorganizar (drag-and-drop).',
          'Adicione novos widgets clicando no botão "+".',
          'Cada widget pode mostrar: negócios por etapa, metas, tarefas, propostas, pedidos, etc.',
        ],
        tips: [
          'A personalização do dashboard é salva por usuário.',
          'Widgets disponíveis incluem mais de 25 tipos de métricas diferentes.',
        ],
      },
    ],
  },
  {
    id: 'pipeline',
    title: '3. Pipeline de Vendas',
    icon: Target,
    description: 'Gestão de oportunidades de negócio através de etapas do funil de vendas.',
    path: '/pipeline',
    content: [
      {
        subtitle: 'Visão Kanban vs Lista',
        steps: [
          'Use os botões no topo para alternar entre visualização Kanban e Lista.',
          'Kanban: cards organizados em colunas por etapa — ideal para gestão visual e drag-and-drop.',
          'Lista: tabela ordenável com todas as informações em uma linha — ideal para análise e filtros.',
          'Ambas as visualizações mostram os mesmos dados, apenas a apresentação muda.',
        ],
        tips: [
          'Use Kanban para reuniões de pipeline e visão geral do funil.',
          'Use Lista para filtrar, ordenar e analisar detalhadamente grandes volumes.',
        ],
      },
      {
        subtitle: 'Seletor de Pipeline',
        steps: [
          'No topo da tela, selecione qual pipeline deseja visualizar.',
          'Pipelines diferentes podem ter etapas, SLAs e regras distintas.',
          'Exemplo: Pipeline de Vendas Novas, Pipeline de Renovação, Pipeline Pós-Venda.',
          'Cada pipeline tem suas próprias métricas e indicadores.',
          'A entidade jurídica selecionada também filtra os negócios exibidos.',
        ],
      },
      {
        subtitle: 'Criar Novo Negócio',
        steps: [
          'Clique no botão "Novo Negócio" no canto superior direito.',
          'Preencha o Nome do negócio (obrigatório) — use nome descritivo como "Projeto ERP - Empresa X".',
          'Informe o Valor estimado da oportunidade.',
          'Selecione a Empresa relacionada (cliente) — pode criar empresa rapidamente pelo botão "+".',
          'Escolha o Contato principal — pode criar contato rapidamente pelo botão "+".',
          'Defina a Data Prevista de fechamento.',
          'Selecione o Pipeline e a etapa inicial do funil.',
          'A Entidade Jurídica é definida automaticamente conforme seleção ativa.',
          'Clique em "Criar" para salvar.',
        ],
        tips: [
          'Nomes de negócios claros facilitam a identificação no Kanban.',
          'Valores realistas melhoram a precisão das previsões de receita.',
          'Use a criação rápida de empresa/contato para não sair do fluxo.',
        ],
      },
      {
        subtitle: 'Mover entre Etapas (Kanban)',
        steps: [
          'Clique e segure no card do negócio.',
          'Arraste para a coluna da etapa desejada.',
          'Solte o card para confirmar a mudança.',
          'Um registro automático é criado no histórico de etapas.',
          'A probabilidade de fechamento é atualizada conforme a etapa.',
        ],
        warnings: [
          'Ao mover para "Fechado (Perdido)", você deverá obrigatoriamente informar o motivo da perda.',
          'Algumas etapas possuem checklist obrigatório — complete todos os itens antes de avançar.',
          'Movimentações para etapas anteriores podem exigir justificativa de SLA.',
        ],
      },
      {
        subtitle: 'Checklist de Etapa',
        steps: [
          'Algumas etapas possuem checklist de atividades obrigatórias configuradas pelo administrador.',
          'Ao tentar avançar de etapa, um modal exibe o checklist pendente.',
          'Marque os itens conforme forem completados.',
          'Itens marcados como "obrigatórios" impedem o avanço se não completados.',
          'Itens opcionais são recomendados, mas não bloqueiam a movimentação.',
          'Você pode adicionar notas em cada item do checklist.',
        ],
        tips: [
          'Checklists garantem que seu processo de vendas seja seguido corretamente.',
          'Administradores configuram os checklists em Configurações > Checklist de Etapas.',
        ],
      },
      {
        subtitle: 'Painel de Detalhes do Negócio',
        steps: [
          'Clique no card ou linha do negócio para abrir o painel lateral de detalhes.',
          'Aba "Dados": informações gerais, valores, probabilidade e campos personalizados.',
          'Aba "Propostas": criar, visualizar e gerenciar propostas comerciais vinculadas.',
          'Aba "Equipe": adicionar outros participantes ao negócio (co-responsáveis).',
          'Aba "Histórico": timeline completa de alterações, atividades e notas.',
          'Aba "Etapas": visualizar o tempo gasto em cada etapa do funil e histórico de movimentação.',
          'Aba "WhatsApp": enviar mensagens diretamente ao contato do negócio.',
        ],
      },
      {
        subtitle: 'Ações Rápidas do Negócio',
        steps: [
          'No painel do negócio, use os botões de ações rápidas na barra superior:',
          'WhatsApp: enviar mensagem ao contato principal do negócio.',
          'Criar Tarefa: agendar follow-up ou atividade vinculada ao negócio.',
          'Nova Proposta: criar proposta comercial com itens e preços.',
          'Converter em Pedido: transformar negócio ganho em pedido de venda.',
          'Registrar Atividade: adicionar nota, ligação, reunião ou e-mail ao histórico.',
        ],
      },
      {
        subtitle: 'Indicador de SLA (Dias na Etapa)',
        steps: [
          'O badge colorido no card indica o status de SLA do negócio na etapa atual.',
          'Verde: dentro do prazo esperado para a etapa.',
          'Amarelo: próximo do limite — ação recomendada.',
          'Vermelho: SLA estourado — ação urgente necessária.',
          'Ao clicar, veja detalhes de quanto tempo está na etapa e o limite configurado.',
          'Ao estourar SLA, o sistema pode solicitar justificativa para manter na etapa.',
        ],
        warnings: [
          'Negócios com SLA vermelho impactam negativamente seus indicadores de performance.',
          'Justificativas de SLA são registradas e visíveis para administradores.',
        ],
      },
      {
        subtitle: 'Filtros Avançados',
        steps: [
          'Use os filtros acima do pipeline para refinar a visualização.',
          'Responsável: "Meus negócios" ou selecione um vendedor específico.',
          'Etapa: visualize apenas uma etapa específica.',
          'Empresa: filtre negócios de um cliente.',
          'Período: defina intervalo de datas de criação ou fechamento previsto.',
          'Status de SLA: filtre por negócios dentro/fora do prazo.',
          'Combine múltiplos filtros para análises específicas.',
        ],
        tips: [
          'Administradores podem ver negócios de todos os vendedores.',
          'Vendedores veem apenas seus próprios negócios e aqueles em que são participantes.',
        ],
      },
      {
        subtitle: 'Delegação de Carteira',
        steps: [
          'Vendedores podem delegar temporariamente sua carteira a outro vendedor (ex: férias).',
          'Durante a delegação, o delegatário pode gerenciar os negócios.',
          'A delegação tem data de início e fim definidas.',
          'Um badge "Delegado" aparece nos negócios sob delegação.',
        ],
      },
      {
        subtitle: 'Registrar Motivo de Perda',
        steps: [
          'Ao mover um negócio para "Fechado (Perdido)", o modal de motivo é obrigatório.',
          'Selecione um motivo da lista pré-configurada (ex: Preço, Concorrência, Timing, Sem Budget).',
          'Adicione observações detalhadas sobre a perda.',
          'Esses dados alimentam os relatórios de motivos de perda no módulo de Relatórios.',
        ],
        tips: [
          'Motivos de perda bem registrados ajudam a melhorar seu processo comercial.',
          'O gráfico de motivos de perda é uma das ferramentas mais valiosas para gestão.',
        ],
      },
    ],
  },
  {
    id: 'clientes',
    title: '4. Clientes (Empresas e Contatos)',
    icon: Building2,
    description: 'Gestão unificada de empresas clientes, prospects e suas pessoas de contato.',
    path: '/customers',
    content: [
      {
        subtitle: 'Tela de Clientes Unificada',
        steps: [
          'O módulo "Clientes" reúne empresas e contatos em uma única interface.',
          'A listagem principal mostra empresas com indicadores visuais de negócios.',
          'Clique em uma empresa para abrir a ficha completa do cliente.',
          'Use a barra de busca para encontrar por razão social, fantasia, CNPJ ou código ERP.',
          'Filtre por status (ativo/inativo), responsável, cidade, estado ou segmento.',
        ],
      },
      {
        subtitle: 'Cadastrar Nova Empresa',
        steps: [
          'Clique em "Novo Cliente" no canto superior direito.',
          'Preencha a Razão Social (obrigatório).',
          'Informe o CNPJ — o sistema pode buscar automaticamente dados da Receita Federal.',
          'Complete Nome Fantasia e Inscrição Estadual se aplicável.',
          'Selecione o Tipo de Pessoa: PJ (Pessoa Jurídica) ou PF (Pessoa Física).',
          'Adicione endereço completo: logradouro, número, complemento, bairro, cidade, estado, CEP.',
          'Informe telefone, fax e e-mail de contato.',
          'Selecione o Responsável (vendedor) pela conta.',
          'Defina o Regime Tributário: Simples Nacional, Lucro Presumido ou Lucro Real.',
          'Marque se é Contribuinte ICMS e/ou Contribuinte IPI.',
          'Clique em "Salvar" para criar a empresa.',
        ],
        tips: [
          'A consulta de CNPJ preenche automaticamente razão social, endereço e situação cadastral.',
          'Empresas podem ser importadas do ERP via integração Iniflex.',
          'O campo "Origem" indica como o cliente chegou (manual, ERP, prospecção).',
        ],
      },
      {
        subtitle: 'Ficha do Cliente (Detalhe)',
        steps: [
          'A ficha do cliente possui múltiplas abas com informações organizadas:',
          'Aba "Dados Gerais": informações cadastrais, endereço, dados fiscais.',
          'Aba "Contatos": lista de pessoas de contato vinculadas à empresa.',
          'Aba "Negócios": negócios do pipeline vinculados a este cliente.',
          'Aba "Pedidos": pedidos de venda do cliente (com valores e status).',
          'Aba "Análise de Crédito": consulta e histórico de crédito do CNPJ.',
          'Aba "Histórico": auditoria completa de todas as alterações no cadastro.',
        ],
      },
      {
        subtitle: 'Contatos da Empresa',
        steps: [
          'Na aba "Contatos", veja todas as pessoas vinculadas à empresa.',
          'Clique em "Novo Contato" para adicionar uma pessoa.',
          'Preencha: Nome (obrigatório), Sobrenome, E-mail, Telefone, Celular.',
          'Defina Cargo e Departamento na empresa.',
          'Informe CPF para Pessoa Física.',
          'Data de nascimento e gênero são opcionais.',
          'Cada contato pode ter campos personalizados configurados pelo admin.',
        ],
        tips: [
          'O celular é essencial para comunicação via WhatsApp.',
          'Contatos com e-mail recebem propostas comerciais e comunicações.',
        ],
      },
      {
        subtitle: 'Análise de Crédito',
        steps: [
          'Na aba "Análise de Crédito", consulte a situação creditícia do cliente.',
          'Informe o motivo da consulta (obrigatório para auditoria).',
          'O sistema consulta APIs externas e retorna: score de crédito, classificação de risco, situação cadastral.',
          'Um resumo de restrições é exibido quando aplicável.',
          'Todas as consultas ficam registradas no histórico de auditoria de crédito.',
          'O limite de crédito e dados financeiros podem ser gerenciados manualmente.',
        ],
        warnings: [
          'Consultas de crédito são registradas com nome do usuário, motivo e resultado.',
          'Use com responsabilidade — cada consulta pode ter custo associado.',
        ],
      },
      {
        subtitle: 'Dados Financeiros do ERP',
        steps: [
          'Se integrado ao ERP, a empresa exibe dados financeiros sincronizados:',
          'Limite de crédito, saldo devedor e títulos em aberto.',
          'Condição de pagamento e forma de pagamento padrão.',
          'Prazo médio de pagamento e data do último pagamento.',
          'Indicador de títulos vencidos para análise de risco.',
        ],
      },
      {
        subtitle: 'Dados Fiscais do ERP',
        steps: [
          'Dados fiscais sincronizados do ERP incluem:',
          'CST de ICMS, PIS, COFINS e IPI com alíquotas respectivas.',
          'CFOP padrão e enquadramento de IPI.',
          'Redução de base de ICMS quando aplicável.',
          'Tipo de contribuinte e destino de mercadoria.',
        ],
      },
      {
        subtitle: 'Indicadores no Card da Empresa',
        steps: [
          'A coluna "Funil" na listagem mostra badges com quantidade de negócios por status:',
          'Azul: negócios em andamento no pipeline.',
          'Verde: negócios ganhos (fechados com sucesso).',
          'Vermelho: negócios perdidos.',
          'Clique no badge para filtrar e ver a lista de negócios.',
        ],
      },
      {
        subtitle: 'Empresas Matriz e Filiais',
        steps: [
          'Empresas podem ser vinculadas como Matriz ou Filial.',
          'No campo "Empresa Matriz", selecione a matriz se for uma filial.',
          'Filiais herdam algumas configurações e podem compartilhar dados consolidados.',
          'Relatórios podem agrupar dados por grupo empresarial.',
        ],
      },
      {
        subtitle: 'Tabela de Preços da Empresa',
        steps: [
          'Empresas podem ter tabelas de preços específicas vinculadas.',
          'Ao criar propostas para esta empresa, os preços da tabela são aplicados automaticamente.',
          'Se não houver tabela específica, a tabela padrão é utilizada.',
          'A hierarquia de preços é: Tabela do Cliente > Regra por Produto > Tabela Padrão > Preço Base.',
        ],
        tips: [
          'Configure tabelas de preços no módulo de Configurações > Tabelas de Preços.',
        ],
      },
      {
        subtitle: 'Histórico de Auditoria',
        steps: [
          'A aba "Histórico" registra todas as alterações realizadas no cadastro.',
          'Cada registro mostra: data, usuário responsável, campo alterado, valor anterior e novo valor.',
          'Use para rastrear quem fez alterações importantes.',
          'O histórico é imutável — não pode ser editado ou excluído.',
        ],
      },
    ],
  },
  {
    id: 'produtos',
    title: '5. Produtos',
    icon: Package,
    description: 'Catálogo de produtos com especificações técnicas, classificação NCM e preços.',
    path: '/products',
    content: [
      {
        subtitle: 'Cadastrar Produto',
        steps: [
          'Clique em "Novo Produto" no canto superior direito.',
          'Informe o SKU (código único obrigatório).',
          'Preencha o Nome do produto.',
          'Adicione uma Descrição detalhada.',
          'Selecione a Categoria e Subcategoria do produto.',
          'Defina o Preço Unitário base.',
          'Selecione a Unidade de Medida (un, kg, m², m, cx, etc.).',
        ],
      },
      {
        subtitle: 'Classificação NCM',
        steps: [
          'O campo NCM (Nomenclatura Comum do Mercosul) é fundamental para fins fiscais.',
          'Use o seletor inteligente de NCM para buscar pelo código ou descrição.',
          'O sistema valida semanticamente se o NCM é compatível com o produto.',
          'Um badge de validação mostra o status: ✅ válido, ⚠️ atenção, ❌ inválido.',
          'Sugestões fiscais são exibidas automaticamente com base no NCM selecionado.',
        ],
        tips: [
          'NCM correto é essencial para cálculo tributário automatizado.',
          'Use a validação semântica para evitar classificações incorretas.',
        ],
      },
      {
        subtitle: 'Especificações Técnicas',
        steps: [
          'Informe as dimensões: Largura, Comprimento e Espessura.',
          'Selecione o Material (ex: Aço, Alumínio, Plástico, Borracha).',
          'Escolha a Cor do produto.',
          'Especificações são utilizadas em propostas e fichas técnicas.',
        ],
        tips: [
          'Medidas são utilizadas para cálculos automáticos em propostas.',
          'Produtos importados do ERP trazem especificações automaticamente.',
        ],
      },
      {
        subtitle: 'Ativar/Inativar Produtos',
        steps: [
          'Use o toggle "Ativo/Inativo" para controlar a disponibilidade.',
          'Produtos inativos não aparecem nas seleções de propostas e pedidos.',
          'Produtos inativos mantêm todo o histórico anterior.',
          'Útil para produtos descontinuados ou temporariamente indisponíveis.',
        ],
      },
      {
        subtitle: 'Produtos do ERP (Sincronizados)',
        steps: [
          'Produtos importados do ERP exibem badge "ERP" ou "Iniflex".',
          'Dados como código, descrição, grupo, subgrupo e NCM vêm do ERP.',
          'Preço de venda e custo médio são atualizados na sincronização.',
          'Alterações locais podem ser sobrescritas na próxima sincronização.',
        ],
      },
      {
        subtitle: 'Filtros e Busca',
        steps: [
          'Use a barra de busca para encontrar por SKU, nome, descrição ou código ERP.',
          'Filtre por Categoria para ver produtos específicos.',
          'Filtre por Status (Ativo/Inativo).',
          'Ordene por nome, preço, data de criação ou SKU.',
        ],
      },
    ],
  },
  {
    id: 'precos',
    title: '6. Tabelas de Preços',
    icon: DollarSign,
    description: 'Políticas de preços, descontos, condições comerciais e autorização de preços.',
    path: '/pricing',
    content: [
      {
        subtitle: 'Criar Nova Tabela',
        steps: [
          'Acesse Configurações > Tabelas de Preços.',
          'Clique em "Nova Tabela de Preços".',
          'Defina um nome identificador (ex: "Distribuidor", "Varejo", "VIP", "Exportação").',
          'Adicione uma descrição explicando as condições e público-alvo.',
          'Marque se é a tabela padrão do sistema (apenas uma pode ser padrão).',
          'Defina as datas de validade (início e fim).',
        ],
      },
      {
        subtitle: 'Definir Regras de Preço',
        steps: [
          'Na aba "Regras", adicione as condições de preço para cada produto.',
          'Regra por Produto: preço fixo ou percentual de desconto para produto específico.',
          'Regra por Quantidade: desconto progressivo a partir de X unidades.',
          'Regra por Categoria: desconto para toda uma categoria de produtos.',
          'Defina a prioridade (ordem de aplicação das regras quando há conflito).',
        ],
        tips: [
          'Regras mais específicas devem ter maior prioridade.',
          'Exemplo: regra de produto sobrescreve regra de categoria automaticamente.',
        ],
      },
      {
        subtitle: 'Vincular a Clientes',
        steps: [
          'Na aba "Vínculos", associe a tabela a empresas clientes.',
          'Busque o cliente pelo nome ou CNPJ.',
          'Clique em "Adicionar" para vincular.',
          'Clientes vinculados terão os preços aplicados automaticamente em propostas.',
        ],
        warnings: [
          'Um cliente pode ter apenas uma tabela ativa por vez.',
          'Ao vincular nova tabela, a anterior é automaticamente desvinculada.',
        ],
      },
      {
        subtitle: 'Hierarquia de Preços',
        steps: [
          'O sistema aplica automaticamente a seguinte hierarquia:',
          '1º Tabela do Cliente: se o cliente tem tabela específica, ela prevalece.',
          '2º Regra por Produto: se há regra específica para o produto.',
          '3º Tabela Padrão: tabela configurada como padrão do sistema.',
          '4º Preço Base: preço unitário cadastrado no produto.',
        ],
      },
      {
        subtitle: 'Autorização de Preço (Price Override)',
        steps: [
          'Vendedores comuns não podem editar preços quando uma tabela está ativa.',
          'Administradores podem realizar "Price Override" (exceção de preço).',
          'Uma justificativa obrigatória (mínimo 10 caracteres) é exigida.',
          'A justificativa é validada tanto ao sair do campo quanto ao submeter o formulário.',
          'Todas as exceções são registradas no histórico de auditoria para controle gerencial.',
        ],
        warnings: [
          'Exceções de preço sem justificativa adequada são bloqueadas pelo sistema.',
        ],
      },
    ],
  },
  {
    id: 'pedidos',
    title: '7. Pedidos',
    icon: ShoppingCart,
    description: 'Gestão de pedidos de venda, workflow de aprovação e acompanhamento.',
    path: '/orders',
    content: [
      {
        subtitle: 'Criar Pedido Manual',
        steps: [
          'Clique em "Novo Pedido" no canto superior direito.',
          'Selecione a Empresa cliente.',
          'Escolha o Contato responsável.',
          'Selecione a Entidade Jurídica emissora.',
          'Adicione os itens do pedido: produto, quantidade e preço unitário.',
          'Os preços são aplicados automaticamente conforme tabela de preços do cliente.',
          'Revise valor total, descontos e condições.',
          'Clique em "Salvar" para criar o pedido como "Pendente".',
        ],
      },
      {
        subtitle: 'Pedido via Proposta Aprovada',
        steps: [
          'Quando uma proposta é aprovada pelo cliente (via link público), um pedido pode ser criado.',
          'O pedido herda todos os itens, preços e condições da proposta original.',
          'O status inicial é "Pendente" aguardando aprovação interna.',
          'Você pode editar o pedido antes de processá-lo.',
        ],
        tips: [
          'Propostas aprovadas são a forma mais segura de gerar pedidos — evita erros de digitação.',
        ],
      },
      {
        subtitle: 'Workflow de Aprovação',
        steps: [
          'Pedidos seguem um fluxo de aprovação configurável pelo administrador.',
          'Regras de aprovação podem ser baseadas em: valor do pedido, tipo de cliente, desconto aplicado.',
          'Cada nível de aprovação pode ter aprovadores específicos.',
          'Vendedor libera o pedido: muda de "Pendente" para a próxima etapa.',
          'Administrador ou gerente aprova/rejeita conforme regras.',
          'Cada mudança de status é registrada com data/hora, usuário e observações.',
        ],
      },
      {
        subtitle: 'Status do Pedido',
        steps: [
          'Pendente: aguardando aprovação para processamento.',
          'Em Produção: pedido autorizado e em fabricação/preparação.',
          'Produzido: produto pronto para faturamento.',
          'Faturado: nota fiscal emitida, aguardando expedição.',
          'Entregue: pedido entregue ao cliente com sucesso.',
          'Cancelado: pedido cancelado (requer justificativa obrigatória).',
        ],
      },
      {
        subtitle: 'Histórico de Aprovações',
        steps: [
          'Clique no pedido para ver detalhes completos.',
          'A timeline de aprovações mostra todas as etapas do workflow.',
          'Cada aprovação registra: status anterior, novo status, data, hora e responsável.',
          'Notas de aprovação/rejeição ficam registradas para consulta futura.',
        ],
      },
      {
        subtitle: 'Filtros de Pedidos',
        steps: [
          'Filtre por status: Pendente, Em Produção, Faturado, etc.',
          'Filtre por cliente, vendedor responsável ou período.',
          'Busque pelo número do pedido.',
          'Ordene por data, valor ou status.',
        ],
      },
    ],
  },
  {
    id: 'estoque',
    title: '8. Estoque',
    icon: Eye,
    description: 'Consulta de posições de estoque sincronizadas do ERP.',
    path: '/stock',
    content: [
      {
        subtitle: 'Visão Geral do Estoque',
        steps: [
          'O módulo de Estoque exibe as posições de estoque sincronizadas do ERP.',
          'Visualize quantidade disponível por produto e almoxarifado.',
          'Dados são atualizados conforme sincronização com o ERP.',
          'Use a busca para localizar produtos por código, SKU ou descrição.',
        ],
      },
      {
        subtitle: 'Consultar Disponibilidade',
        steps: [
          'Busque o produto desejado pela barra de pesquisa.',
          'Veja a quantidade disponível, reservada e total.',
          'Verifique o almoxarifado ou localização do estoque.',
          'Use essa informação antes de confirmar pedidos.',
        ],
        tips: [
          'Consulte o estoque antes de enviar propostas com prazo de entrega apertado.',
          'Dados de estoque dependem da sincronização com o ERP — verifique a data da última atualização.',
        ],
      },
    ],
  },
  {
    id: 'tarefas',
    title: '9. Tarefas',
    icon: CheckSquare,
    description: 'Gestão de atividades, follow-ups, compromissos e calendário integrado.',
    path: '/tasks',
    content: [
      {
        subtitle: 'Criar Nova Tarefa',
        steps: [
          'Clique em "Nova Tarefa" no canto superior direito.',
          'Defina o Título da tarefa (obrigatório) — seja específico e objetivo.',
          'Adicione uma Descrição detalhada do que precisa ser feito.',
          'Selecione a Data de vencimento e, opcionalmente, o Horário.',
          'Escolha a Prioridade: Baixa, Média, Alta ou Urgente.',
          'Vincule a uma Empresa, Contato ou Negócio relacionado (opcional mas recomendado).',
          'Atribua a um responsável (você mesmo ou outro membro da equipe).',
          'Clique em "Salvar".',
        ],
      },
      {
        subtitle: 'Visualização em Lista',
        steps: [
          'A aba "Lista" mostra tarefas em formato de tabela.',
          'Filtre por status: Pendentes, Em Andamento, Concluídas, Canceladas.',
          'Filtre por "Minhas Tarefas" ou veja de toda a equipe.',
          'Ordene por data de vencimento, prioridade ou título.',
          'Clique no checkbox para marcar como concluída rapidamente.',
          'Clique na tarefa para abrir o drawer de detalhes.',
        ],
      },
      {
        subtitle: 'Calendário de Tarefas',
        steps: [
          'Use a aba "Calendário" para ver tarefas em formato visual (FullCalendar).',
          'Visualizações disponíveis: Dia, Semana, Mês.',
          'Arraste e solte tarefas para reagendar facilmente.',
          'Clique em uma data vazia para criar nova tarefa.',
          'Cores das tarefas indicam prioridade e status.',
          'Tarefas do Google Calendar aparecem integradas (se configurado).',
        ],
        tips: [
          'A visão semanal é ideal para planejamento de rotina.',
          'A visão mensal ajuda a identificar dias sobrecarregados.',
          'Eventos do Google Calendar aparecem com badge de origem diferente.',
        ],
      },
      {
        subtitle: 'Prioridades',
        steps: [
          'Baixa (cinza): tarefas sem urgência, podem ser feitas quando possível.',
          'Média (azul): importância normal, deve ser feita no prazo.',
          'Alta (laranja): requer atenção prioritária, fazer o quanto antes.',
          'Urgente (vermelho): ação imediata necessária, prioridade máxima.',
        ],
        tips: [
          'Tarefas urgentes aparecem sempre no topo das listas.',
          'Use urgente com moderação para manter o significado e eficácia dos alertas.',
        ],
      },
      {
        subtitle: 'Drawer de Detalhes',
        steps: [
          'Clique em qualquer tarefa para abrir o drawer lateral.',
          'Veja e edite todas as informações da tarefa.',
          'Visualize as entidades vinculadas com links clicáveis.',
          'Veja quem criou e quando a tarefa foi criada.',
          'Altere o status, prioridade ou data diretamente.',
          'Adicione ou edite a descrição.',
        ],
      },
      {
        subtitle: 'Concluir e Gerenciar Tarefas',
        steps: [
          'Clique no checkbox ao lado da tarefa para marcá-la como concluída.',
          'A data e hora de conclusão são registradas automaticamente.',
          'Tarefas concluídas são movidas para a lista de "Concluídas".',
          'Você pode reabrir uma tarefa concluída se necessário.',
          'Tarefas podem ser canceladas com justificativa.',
        ],
      },
    ],
  },
  {
    id: 'insights',
    title: '10. Insights',
    icon: Lightbulb,
    description: 'Alertas inteligentes, análises automáticas e recomendações de ação.',
    path: '/insights',
    content: [
      {
        subtitle: 'Visão Geral dos Insights',
        steps: [
          'O módulo Insights analisa seus dados automaticamente e identifica situações que requerem atenção.',
          'Cards de resumo no topo mostram quantidade de alertas por categoria.',
          'Clique em cada categoria para ver a lista detalhada.',
          'Insights são atualizados em tempo real conforme os dados mudam.',
        ],
      },
      {
        subtitle: 'Negócios Estagnados',
        steps: [
          'Lista negócios que estão parados há mais tempo que o esperado (baseado no SLA da etapa).',
          'Mostra há quantos dias o negócio está na etapa atual.',
          'Indica o SLA configurado para a etapa e se está estourado.',
          'Exibe o valor e responsável do negócio.',
          'Clique para ir diretamente ao negócio no pipeline.',
        ],
        tips: [
          'Defina SLAs realistas para cada etapa do pipeline em Configurações.',
        ],
      },
      {
        subtitle: 'Propostas Expirando',
        steps: [
          'Mostra propostas com validade próxima do vencimento ou já expiradas.',
          'Ordena por urgência (mais próximas do vencimento primeiro).',
          'Indica valor, cliente e data de expiração de cada proposta.',
          'Permite enviar lembrete ao cliente ou renovar a proposta.',
        ],
      },
      {
        subtitle: 'Tarefas Atrasadas',
        steps: [
          'Lista tarefas que já passaram da data de vencimento e não foram concluídas.',
          'Mostra há quantos dias está atrasada e a prioridade.',
          'Permite concluir ou reagendar diretamente da lista.',
          'Cores indicam gravidade do atraso.',
        ],
      },
      {
        subtitle: 'Clientes Inativos',
        steps: [
          'Identifica clientes sem interação (atividade, negócio ou tarefa) há muito tempo.',
          'Mostra a última atividade registrada e há quanto tempo.',
          'Sugere ações de reativação baseadas no histórico.',
          'Útil para campanhas de reengajamento e manutenção de carteira.',
        ],
      },
    ],
  },
  {
    id: 'relatorios',
    title: '11. Relatórios e Dashboard',
    icon: BarChart3,
    description: 'Análises de performance, métricas, funil de vendas e relatórios operacionais.',
    path: '/reports',
    content: [
      {
        subtitle: 'Dashboard Personalizado',
        steps: [
          'O módulo Relatórios oferece um dashboard com widgets personalizáveis.',
          'Adicione widgets clicando no botão "Adicionar Widget".',
          'Tipos disponíveis: métricas numéricas, gráficos, listas, etc.',
          'Arraste widgets para reorganizar o layout conforme sua preferência.',
          'Configuração é salva automaticamente por usuário.',
        ],
      },
      {
        subtitle: 'Funil de Vendas',
        steps: [
          'Visualize a distribuição de negócios por etapa do pipeline.',
          'O gráfico mostra quantidade e valor total em cada fase do funil.',
          'Compare a taxa de conversão entre etapas adjacentes.',
          'Identifique gargalos onde negócios estão parando ou sendo perdidos.',
        ],
      },
      {
        subtitle: 'Velocidade do Pipeline',
        steps: [
          'Analise o tempo médio que negócios permanecem em cada etapa.',
          'Compare com períodos anteriores para identificar tendências.',
          'Identifique etapas com tempo acima da média.',
          'Use para definir e ajustar SLAs mais realistas.',
        ],
      },
      {
        subtitle: 'Motivos de Perda',
        steps: [
          'Veja os principais motivos de negócios perdidos em gráfico de pizza.',
          'Distribuição percentual mostra onde você mais perde negócios.',
          'Clique em um motivo para ver os negócios relacionados.',
          'Use para melhorar sua abordagem comercial e corrigir fraquezas.',
        ],
        tips: [
          'Registrar motivos de perda corretamente é fundamental para esta análise funcionar.',
        ],
      },
      {
        subtitle: 'Relatórios Operacionais',
        steps: [
          'A aba "Operacional" oferece monitoramento detalhado:',
          'Monitor de SLA: veja negócios dentro e fora do prazo por etapa.',
          'Grid de Status de Pedidos: acompanhe o fluxo completo de pedidos.',
          'Log de Atividades: histórico detalhado de ações dos usuários.',
          'Filtros por período, vendedor, pipeline e entidade jurídica.',
        ],
      },
      {
        subtitle: 'Exportar Relatórios em PDF',
        steps: [
          'Clique no botão "Imprimir/PDF" para gerar relatório.',
          'O relatório é gerado em formato pronto para impressão.',
          'Inclui gráficos, tabelas e métricas do período selecionado.',
          'Útil para reuniões gerenciais e apresentações.',
        ],
      },
    ],
  },
  {
    id: 'bi-avancado',
    title: '12. BI Avançado',
    icon: Brain,
    description: 'Inteligência de negócios com drill-down, análise de performance e detecção de anomalias.',
    path: '/reports',
    adminOnly: true,
    content: [
      {
        subtitle: 'Acessando o BI Avançado',
        steps: [
          'Acesse o módulo Relatórios (Dashboard no menu).',
          'Clique na aba "BI Avançado" (disponível apenas para administradores).',
          'Use os filtros globais para definir o período e escopo da análise.',
          'Os dados são carregados automaticamente conforme filtros.',
        ],
      },
      {
        subtitle: 'Filtros Globais do BI',
        steps: [
          'Período: selecione o intervalo de datas para análise (últimos 7, 30, 90 dias, etc.).',
          'Vendedor: filtre por vendedor específico ou veja toda a equipe.',
          'Pipeline: escolha qual funil analisar.',
          'Os filtros afetam todas as seções da página simultaneamente.',
        ],
      },
      {
        subtitle: 'Saúde do Pipeline',
        steps: [
          'Visualize métricas de saúde do funil por etapa em formato de tabela.',
          'Tempo médio em etapa: quantos dias em média cada negócio permanece.',
          'Violações de SLA: quantos negócios estouraram o prazo configurado.',
          'Taxa de avanço: percentual de negócios que avançam para próxima etapa.',
          'Clique em qualquer número para ver a lista detalhada (drill-down).',
        ],
      },
      {
        subtitle: 'Performance dos Vendedores',
        steps: [
          'Compare o desempenho de todos os vendedores lado a lado.',
          'Métricas incluem: negócios ganhos, valor total, taxa de conversão.',
          'Comparação com período anterior mostra tendência (↑ melhor, ↓ pior).',
          'Tempo médio de ciclo de vendas por vendedor.',
          'Identifique top performers e quem precisa de coaching.',
        ],
        tips: [
          'Use esta análise em reuniões semanais de pipeline com a equipe.',
        ],
      },
      {
        subtitle: 'Detecção de Anomalias',
        steps: [
          'O sistema identifica automaticamente situações anômalas:',
          'Pipeline inchado: muitos negócios acumulados sem conversão.',
          'Negócios de alto valor parados: oportunidades grandes estagnadas.',
          'Quedas bruscas de performance: alertas de tendência negativa.',
          'Cada anomalia tem explicação detalhada e ação sugerida.',
        ],
        warnings: [
          'Anomalias críticas aparecem em destaque — investigue imediatamente.',
        ],
      },
      {
        subtitle: 'Drill-Down de Dados',
        steps: [
          'Clique em qualquer número nas tabelas para abrir o modal de detalhes.',
          'O modal mostra a lista completa de registros que compõem o número.',
          'Cada registro tem link direto para o pipeline ou cadastro.',
          'Exporte a lista detalhada se necessário.',
        ],
      },
    ],
  },
  {
    id: 'copiloto',
    title: '13. Copiloto IA',
    icon: Sparkles,
    description: 'Assistente inteligente com IA para suporte às vendas e análise de dados.',
    content: [
      {
        subtitle: 'O que é o Copiloto IA',
        steps: [
          'O Copiloto é um assistente de inteligência artificial integrado ao CRM.',
          'Ele analisa seus dados e oferece sugestões contextuais.',
          'Pode responder perguntas sobre seus clientes, negócios e métricas.',
          'Funciona como um chat interativo no canto inferior direito da tela.',
        ],
      },
      {
        subtitle: 'Como Usar',
        steps: [
          'Clique no ícone do Copiloto (✨) no canto inferior direito.',
          'Digite sua pergunta ou solicitação no campo de texto.',
          'Exemplos: "Quais negócios estão estagnados?", "Resumo da minha semana".',
          'O Copiloto analisa o contexto e responde com dados reais do sistema.',
          'Você pode usar voz para ditar suas perguntas (ícone de microfone).',
        ],
        tips: [
          'Perguntas específicas geram respostas mais úteis.',
          'O Copiloto tem acesso ao contexto dos seus dados — aproveite!',
          'O prompt do Copiloto pode ser personalizado pelo administrador em Configurações.',
        ],
      },
      {
        subtitle: 'Sugestões Automáticas',
        steps: [
          'O Copiloto pode sugerir ações baseadas em padrões dos dados.',
          'Sugestões de follow-up para negócios promissores.',
          'Alertas de clientes que precisam de atenção.',
          'Recomendações de produtos baseadas no histórico do cliente.',
        ],
      },
    ],
  },
  {
    id: 'whatsapp',
    title: '14. WhatsApp',
    icon: MessageSquare,
    description: 'Comunicação integrada via WhatsApp com clientes, templates e análise de conversas.',
    path: '/whatsapp',
    content: [
      {
        subtitle: 'Conectando o WhatsApp',
        steps: [
          'Acesse o módulo WhatsApp no menu lateral.',
          'Clique em "Conectar Instância" para adicionar um número.',
          'Informe o nome da instância e as credenciais da API (Z-API).',
          'Escaneie o QR Code que aparece na tela com o WhatsApp do celular.',
          'Aguarde a confirmação de conexão — status mudará para "Conectado".',
          'Sua instância ficará ativa para envio e recebimento de mensagens.',
        ],
        warnings: [
          'Use um número de WhatsApp comercial dedicado para não misturar mensagens pessoais.',
          'Não desconecte o celular — mantenha-o sempre conectado à internet.',
          'Múltiplas instâncias podem ser configuradas para diferentes números.',
        ],
      },
      {
        subtitle: 'Lista de Conversas',
        steps: [
          'A tela principal mostra todas as conversas ativas à esquerda.',
          'Conversas são ordenadas pela mensagem mais recente.',
          'Badge numérico indica quantidade de mensagens não lidas.',
          'Clique em uma conversa para abrir o chat à direita.',
          'Busque conversas pelo nome do contato ou número.',
        ],
      },
      {
        subtitle: 'Enviando Mensagens',
        steps: [
          'Selecione uma conversa existente ou inicie nova pelo contato.',
          'Digite sua mensagem no campo inferior do chat.',
          'Use Enter para enviar ou clique no botão de envio.',
          'Mensagens enviadas aparecem à direita (azul), recebidas à esquerda (cinza).',
          'Data e hora são registradas em cada mensagem.',
        ],
      },
      {
        subtitle: 'Templates de Mensagem',
        steps: [
          'Use templates para mensagens frequentes e padronizadas.',
          'Clique no ícone de template ao lado do campo de texto.',
          'Selecione o template desejado da lista.',
          'Templates podem conter variáveis que são substituídas automaticamente ({nome}, {empresa}).',
          'Personalize se necessário antes de enviar.',
        ],
        tips: [
          'Templates economizam tempo em mensagens repetitivas.',
          'Configure templates em Configurações > Templates WhatsApp.',
          'Templates bem escritos melhoram a consistência da comunicação.',
        ],
      },
      {
        subtitle: 'Análise de Conversas com IA',
        steps: [
          'O sistema pode analisar o sentimento de uma conversa usando IA.',
          'Clique em "Analisar" no painel lateral da conversa.',
          'Veja a classificação do sentimento: positivo, neutro ou negativo.',
          'Receba sugestões de como prosseguir com base no tom da conversa.',
          'O resumo inclui pontos-chave e próximos passos sugeridos.',
        ],
      },
      {
        subtitle: 'Métricas de WhatsApp',
        steps: [
          'Acesse a aba "Métricas" no módulo WhatsApp.',
          'Total de mensagens enviadas e recebidas no período.',
          'Tempo médio de resposta da sua equipe.',
          'Distribuição por horário de pico de conversas.',
          'Quantidade de conversas ativas por período.',
        ],
      },
    ],
  },
  {
    id: 'prospeccao',
    title: '15. Prospecção',
    icon: Globe,
    description: 'Busca e qualificação de novos leads e prospects usando dados públicos.',
    path: '/prospecting',
    content: [
      {
        subtitle: 'Buscar Novos Leads',
        steps: [
          'Acesse o módulo Prospecção no menu lateral.',
          'Use os filtros para definir seu público-alvo.',
          'Filtros disponíveis: UF/estado, cidade, atividade principal (CNAE), porte.',
          'Defina termo de busca para refinar resultados.',
          'Clique em "Buscar" para encontrar empresas em fontes públicas.',
        ],
      },
      {
        subtitle: 'Resultados da Busca',
        steps: [
          'Os resultados mostram empresas encontradas em formato de cards.',
          'Cada card exibe: razão social, CNPJ, localização, atividade principal.',
          'Dados incluem telefone, e-mail e endereço quando disponíveis.',
          'Clique em "Ver Detalhes" para informações completas.',
          'Empresas já cadastradas no CRM são sinalizadas.',
        ],
      },
      {
        subtitle: 'Importar para o CRM',
        steps: [
          'Ao encontrar um lead interessante, clique em "Importar para CRM".',
          'O sistema cria automaticamente a empresa no CRM com os dados disponíveis.',
          'Você pode criar um negócio no pipeline diretamente a partir do lead.',
          'O lead importado aparece com origem "Prospecção".',
        ],
        tips: [
          'Revise e complete os dados importados antes de iniciar a abordagem comercial.',
          'Use o CNPJ para consultar informações adicionais na Receita Federal.',
        ],
      },
      {
        subtitle: 'Histórico de Prospecção',
        steps: [
          'A aba "Histórico" mostra todas as buscas realizadas e leads importados.',
          'Leads já importados para o CRM são sinalizados com badge.',
          'Evite duplicar cadastros — o sistema alerta se o CNPJ já existe.',
          'Veja data, hora e quem realizou cada busca.',
        ],
      },
    ],
  },
  {
    id: 'emails',
    title: '16. E-mails',
    icon: Mail,
    description: 'Envio de e-mails individuais, em massa e campanhas com rastreamento.',
    path: '/emails',
    content: [
      {
        subtitle: 'Enviar E-mail Individual',
        steps: [
          'Acesse o módulo E-mails no menu lateral.',
          'Clique em "Novo E-mail".',
          'Selecione o destinatário (contato existente ou digite e-mail manualmente).',
          'Escolha um template ou escreva do zero.',
          'Preencha assunto e corpo da mensagem.',
          'Clique em "Enviar" para envio imediato ou "Agendar" para depois.',
        ],
      },
      {
        subtitle: 'Templates de E-mail',
        steps: [
          'Use templates para padronizar comunicações.',
          'Templates podem incluir variáveis dinâmicas: {nome}, {empresa}, {valor}, etc.',
          'Variáveis são substituídas automaticamente pelos dados reais.',
          'Templates podem ser compartilhados com toda a equipe.',
          'Configure e gerencie templates em Configurações.',
        ],
      },
      {
        subtitle: 'Envio em Massa (Bulk)',
        steps: [
          'Selecione múltiplos destinatários para envio em massa.',
          'Escolha um template para padronizar a mensagem.',
          'Variáveis são personalizadas individualmente para cada destinatário.',
          'Acompanhe o status de envio de cada e-mail.',
        ],
        warnings: [
          'Envios em massa devem respeitar a LGPD e políticas anti-spam.',
        ],
      },
      {
        subtitle: 'Agendar Envio',
        steps: [
          'Ao compor o e-mail, clique em "Agendar" em vez de "Enviar".',
          'Selecione data e hora de envio desejados.',
          'E-mails agendados aparecem na fila de envio.',
          'Você pode cancelar ou editar antes do horário programado.',
        ],
        tips: [
          'Agende e-mails para horários comerciais ideais (9h-11h ou 14h-16h).',
        ],
      },
      {
        subtitle: 'Rastreamento de Abertura',
        steps: [
          'E-mails enviados pelo sistema são rastreados automaticamente.',
          'Veja se o destinatário abriu o e-mail e quando.',
          'Acompanhe cliques em links incluídos na mensagem.',
          'Dados de rastreamento ajudam a identificar interesse do lead.',
        ],
      },
    ],
  },
  {
    id: 'bots',
    title: '17. Bots e Automações',
    icon: Bot,
    description: 'Fluxos automatizados de atendimento via WhatsApp e automações de CRM.',
    content: [
      {
        subtitle: 'Visão Geral de Bots',
        steps: [
          'Bots automatizam conversas iniciais via WhatsApp.',
          'Podem coletar informações do cliente antes de transferir para atendimento humano.',
          'Funcionam 24/7, mesmo fora do horário comercial.',
          'Múltiplos fluxos podem ser criados para diferentes situações e gatilhos.',
        ],
      },
      {
        subtitle: 'Criar Novo Bot',
        steps: [
          'Acesse Configurações > Bots.',
          'Clique em "Novo Bot".',
          'Defina nome e descrição do fluxo.',
          'Escolha o tipo de gatilho: mensagem inicial, palavra-chave, horário, etc.',
          'Configure a mensagem de boas-vindas.',
          'Clique em "Editar Fluxo" para abrir o editor visual.',
        ],
      },
      {
        subtitle: 'Editor Visual de Fluxos',
        steps: [
          'O editor usa blocos conectados por setas em uma interface drag-and-drop.',
          'Arraste blocos da barra de ferramentas para a área de trabalho.',
          'Conecte blocos clicando e arrastando entre os pontos de conexão.',
          'Configure cada bloco clicando nele para abrir o painel de propriedades.',
          'Salve o fluxo após concluir a edição.',
        ],
      },
      {
        subtitle: 'Tipos de Blocos Disponíveis',
        steps: [
          'Gatilho (Trigger): define como o bot é acionado.',
          'Mensagem: envia texto ao usuário.',
          'Condição: decide o caminho baseado em resposta do usuário.',
          'Ação: executa ação no CRM (criar tarefa, negócio, registrar contato).',
          'Atraso (Delay): aguarda um tempo configurado antes de continuar.',
          'Transferir: passa a conversa para atendimento humano.',
          'Fim: encerra o fluxo do bot.',
        ],
      },
      {
        subtitle: 'Automações de CRM',
        steps: [
          'Além de bots, o sistema tem automações baseadas em eventos do CRM.',
          'Gatilhos disponíveis: mudança de etapa, criação de registro, atualização, etc.',
          'Ações: enviar e-mail, criar tarefa, notificar usuário, atualizar campo.',
          'Condições podem ser adicionadas para filtrar quando a automação dispara.',
          'Ative ou desative automações conforme necessário.',
        ],
      },
      {
        subtitle: 'Ativar/Desativar Bot',
        steps: [
          'Use o toggle para ativar ou desativar o bot.',
          'Bots inativos não respondem mensagens.',
          'Mantenha apenas bots necessários ativos.',
          'Teste o fluxo antes de ativar em produção.',
        ],
        warnings: [
          'Bots mal configurados podem prejudicar a experiência do cliente.',
          'Sempre inclua uma opção de "Falar com humano" no fluxo.',
        ],
      },
    ],
  },
  {
    id: 'integracoes',
    title: '18. Integrações',
    icon: Zap,
    description: 'Conexões com sistemas externos: ERP Iniflex, Google Calendar, APIs de prospecção.',
    path: '/integrations',
    content: [
      {
        subtitle: 'Integração ERP Iniflex',
        steps: [
          'A integração Iniflex conecta com o ERP da empresa (Projedata).',
          'Sincroniza automaticamente: clientes, contatos, produtos e pedidos.',
          'Dados são atualizados periodicamente conforme configuração.',
          'Evita retrabalho de cadastro duplicado entre CRM e ERP.',
          'Registros sincronizados exibem badge "ERP" ou "Iniflex".',
        ],
      },
      {
        subtitle: 'Sincronizar Clientes do ERP',
        steps: [
          'Acesse Integrações > Iniflex > aba Clientes.',
          'Clique em "Sincronizar" para buscar clientes do ERP.',
          'Clientes novos são importados automaticamente para o CRM.',
          'Clientes existentes são atualizados com dados mais recentes.',
          'O log de sincronização mostra detalhes do processamento.',
        ],
      },
      {
        subtitle: 'Sincronizar Produtos do ERP',
        steps: [
          'Acesse Integrações > Iniflex > aba Produtos.',
          'Clique em "Sincronizar" para atualizar o catálogo.',
          'Produtos sincronizados trazem: código, descrição, grupo, NCM, preço.',
          'Dados de custo médio e estoque podem ser incluídos.',
        ],
      },
      {
        subtitle: 'Sincronizar Pedidos do ERP',
        steps: [
          'Acesse Integrações > Iniflex > aba Pedidos.',
          'Pedidos do ERP são importados com itens, valores e status.',
          'Vinculação automática com clientes já cadastrados.',
          'Status e datas são sincronizados para acompanhamento.',
        ],
      },
      {
        subtitle: 'Log de Sincronização',
        steps: [
          'A aba "Logs" mostra o histórico de todas as sincronizações.',
          'Cada log registra: data/hora, tipo, registros processados, erros.',
          'Use para identificar e resolver problemas de sincronização.',
          'Filtros por tipo e período estão disponíveis.',
        ],
      },
      {
        subtitle: 'Google Calendar',
        steps: [
          'Conecte sua conta Google em Configurações > Google Calendar.',
          'Autorize o acesso clicando no botão "Conectar".',
          'Tarefas do CRM com data aparecem no seu Google Calendar.',
          'Eventos do Google Calendar aparecem no calendário de tarefas.',
          'A sincronização é bidirecional e automática.',
        ],
        tips: [
          'Use para não perder compromissos em nenhuma ferramenta.',
          'Eventos sincronizados são identificados com badge de origem.',
        ],
      },
    ],
  },
  {
    id: 'configuracoes',
    title: '19. Configurações',
    icon: Settings,
    description: 'Configurações do sistema, usuários, permissões, pipelines, metas e mais.',
    path: '/settings',
    adminOnly: true,
    content: [
      {
        subtitle: 'Gerenciar Usuários',
        steps: [
          'Na aba "Usuários", visualize todos os usuários do sistema.',
          'Clique em "Novo Usuário" para criar: informe e-mail, nome completo, senha e perfil.',
          'Perfis disponíveis: Administrador, Vendedor, Atendente.',
          'Edite dados ou altere o perfil de usuários existentes.',
          'Exclua usuários que não devem mais acessar o sistema.',
          'Vincule usuários a entidades jurídicas específicas.',
        ],
        warnings: [
          'Excluir um usuário é irreversível — considere desativar antes.',
        ],
      },
      {
        subtitle: 'Permissões por Módulo',
        steps: [
          'Na aba "Permissões", configure quais módulos cada perfil pode acessar.',
          'Para cada módulo, defina o tipo de acesso: "Total" ou "Restrito".',
          'Total: o usuário vê dados de todos os vendedores.',
          'Restrito: o usuário vê apenas seus próprios dados.',
          'Módulos podem ser completamente bloqueados para determinados perfis.',
        ],
      },
      {
        subtitle: 'Pipelines e Etapas',
        steps: [
          'Na aba "Pipelines", crie e gerencie funis de vendas.',
          'Adicione etapas com: nome, cor, probabilidade de fechamento e SLA (dias).',
          'Defina a ordem das etapas arrastando e soltando.',
          'Configure quais pipelines cada vendedor pode acessar.',
          'Cada pipeline pode ter checklist de etapas independente.',
        ],
        warnings: [
          'Alterar etapas pode afetar negócios existentes — faça com cuidado.',
        ],
      },
      {
        subtitle: 'Checklist de Etapas',
        steps: [
          'Na aba "Checklist", configure itens obrigatórios por etapa do pipeline.',
          'Adicione itens com: título, descrição e se é obrigatório ou opcional.',
          'Itens obrigatórios impedem o vendedor de avançar o negócio de etapa.',
          'Ordene os itens conforme sequência lógica do processo.',
        ],
      },
      {
        subtitle: 'Campos Personalizados',
        steps: [
          'Na aba "Campos", crie campos extras para Empresas, Contatos ou Negócios.',
          'Tipos disponíveis: Texto, Número, Data, Seleção, Múltipla Seleção, Checkbox, URL, Telefone, E-mail, Moeda.',
          'Defina se o campo é obrigatório.',
          'Ordene os campos conforme preferência de exibição.',
          'Campos personalizados aparecem na seção dedicada dos formulários.',
        ],
      },
      {
        subtitle: 'Metas de Vendas',
        steps: [
          'Na aba "Metas", configure objetivos por vendedor e período.',
          'Tipos de meta: valor de fechamento, quantidade de negócios.',
          'Defina o período (mensal, trimestral, anual).',
          'O progresso é calculado automaticamente e exibido no dashboard.',
          'Metas motivam e dão clareza de objetivos para a equipe.',
        ],
      },
      {
        subtitle: 'Carteiras de Clientes',
        steps: [
          'Na aba "Carteiras", atribua empresas a vendedores específicos.',
          'Use a ferramenta de transferência para mover clientes entre vendedores.',
          'Todas as transferências são registradas com justificativa.',
          'Visualize o histórico completo de movimentações de carteira.',
        ],
      },
      {
        subtitle: 'Delegação de Carteira',
        steps: [
          'Na aba "Delegações", configure delegações temporárias entre vendedores.',
          'Útil para férias, licenças ou cobertura temporária.',
          'Defina data de início e fim da delegação.',
          'O delegatário pode gerenciar os negócios do vendedor ausente.',
        ],
      },
      {
        subtitle: 'Remanejamento de Carteira',
        steps: [
          'A ferramenta de remanejamento permite redistribuir clientes em massa.',
          'Filtre clientes por critérios como inatividade, região ou segmento.',
          'Selecione os clientes e o novo responsável.',
          'Confirme o remanejamento — todas as movimentações são registradas.',
        ],
      },
      {
        subtitle: 'Regras de Aprovação de Pedidos',
        steps: [
          'Na aba "Aprovação", configure regras automáticas de aprovação.',
          'Regras podem ser baseadas em: valor do pedido, percentual de desconto, tipo de cliente.',
          'Defina níveis de aprovação e aprovadores para cada regra.',
          'Pedidos que atendem às regras são automaticamente encaminhados.',
        ],
      },
      {
        subtitle: 'Tabelas de Preços',
        steps: [
          'Crie e gerencie tabelas de preços com regras de desconto.',
          'Vincule tabelas a clientes específicos.',
          'Defina validade, prioridade e condições comerciais.',
          'Veja a seção "Tabelas de Preços" deste manual para detalhes completos.',
        ],
      },
      {
        subtitle: 'Entidades Jurídicas (Multi-CNPJ)',
        steps: [
          'Na aba "Entidades", gerencie os CNPJs da empresa.',
          'Cada entidade jurídica tem razão social, CNPJ e dados próprios.',
          'Configure quais usuários podem acessar cada entidade.',
          'Negócios e pedidos são vinculados a entidades jurídicas específicas.',
        ],
        tips: [
          'Empresas com múltiplos CNPJs devem ter cada um cadastrado como entidade.',
          'O seletor de entidade no topo filtra todos os dados do sistema.',
        ],
      },
      {
        subtitle: 'Automações',
        steps: [
          'Na aba "Automações", crie regras automáticas baseadas em eventos.',
          'Gatilhos: mudança de etapa, criação de registro, prazo expirado, etc.',
          'Ações: enviar e-mail, criar tarefa, notificar, atualizar campo.',
          'Ative ou desative automações conforme necessário.',
        ],
      },
      {
        subtitle: 'Configurações Fiscais',
        steps: [
          'Na aba "Fiscal", gerencie configurações tributárias.',
          'Cadastre benefícios fiscais e créditos presumidos.',
          'Configure regras de imposto seletivo.',
          'Gerencie a transição para o novo regime tributário (Reforma Tributária 2026).',
        ],
      },
      {
        subtitle: 'Templates de WhatsApp',
        steps: [
          'Na aba "WhatsApp", configure mensagens-padrão para o WhatsApp.',
          'Use variáveis para personalização automática ({nome}, {empresa}, {valor}).',
          'Organize templates por categoria para facilitar a seleção.',
          'Templates bem escritos melhoram a produtividade da equipe.',
        ],
      },
      {
        subtitle: 'Notificações',
        steps: [
          'Na aba "Notificações", configure alertas e lembretes.',
          'Defina antecedência de lembrete de tarefas (horas/dias antes).',
          'Configure alertas de negócios estagnados (após X dias sem atividade).',
          'Ative/desative tipos de notificação conforme necessidade.',
        ],
      },
      {
        subtitle: 'Copiloto IA',
        steps: [
          'Na aba "Copiloto", personalize o prompt do assistente de IA.',
          'Defina o contexto e personalidade do assistente.',
          'Adapte as respostas ao vocabulário e processos da sua empresa.',
        ],
      },
      {
        subtitle: 'API de Prospecção',
        steps: [
          'Na aba "Prospecção", configure as APIs de busca de leads.',
          'Informe credenciais de acesso à API de dados públicos.',
          'Teste a conexão antes de salvar.',
        ],
      },
      {
        subtitle: 'Log de Intervenções Administrativas',
        steps: [
          'Na aba "Intervenções", veja o histórico de ações administrativas.',
          'Inclui: transferências forçadas de carteira, edição de dados alheios, etc.',
          'Cada intervenção registra: admin responsável, justificativa, data e detalhes.',
          'Garante transparência e governança nas ações de gestão.',
        ],
      },
    ],
  },
  {
    id: 'propostas',
    title: '20. Propostas Comerciais',
    icon: FileText,
    description: 'Criação, envio e acompanhamento de propostas comerciais com link de aprovação.',
    content: [
      {
        subtitle: 'Criar Proposta',
        steps: [
          'No painel do negócio, acesse a aba "Propostas" e clique em "Nova Proposta".',
          'Selecione os produtos do catálogo e defina quantidades.',
          'Os preços são aplicados automaticamente conforme tabela de preços do cliente.',
          'Adicione observações e condições comerciais.',
          'Defina a data de validade da proposta.',
          'Clique em "Salvar" para criar a proposta.',
        ],
      },
      {
        subtitle: 'Autorização de Preço em Propostas',
        steps: [
          'Se o preço for alterado manualmente (por admin), uma justificativa é obrigatória.',
          'O campo de justificativa aparece automaticamente ao editar o preço.',
          'Mínimo de 10 caracteres é exigido para a justificativa.',
          'A alteração é registrada no histórico de auditoria.',
        ],
      },
      {
        subtitle: 'Enviar Proposta ao Cliente',
        steps: [
          'Clique em "Gerar Link" para criar um link público de aprovação.',
          'O link permite que o cliente visualize a proposta completa.',
          'O cliente pode aprovar ou recusar diretamente pelo link.',
          'Copie o link e envie por e-mail ou WhatsApp.',
        ],
      },
      {
        subtitle: 'Gerar PDF da Proposta',
        steps: [
          'Clique em "Gerar PDF" para criar um documento formatado.',
          'O PDF inclui logotipo, dados da empresa, itens, valores e condições.',
          'Faça download ou envie diretamente ao cliente.',
        ],
      },
      {
        subtitle: 'Acompanhar Status',
        steps: [
          'A lista de propostas mostra o status de cada uma: Rascunho, Enviada, Aprovada, Recusada, Expirada.',
          'Propostas aprovadas podem ser convertidas em pedidos automaticamente.',
          'Propostas próximas do vencimento aparecem nos Insights.',
        ],
      },
    ],
  },
  {
    id: 'dicas',
    title: '21. Dicas e Boas Práticas',
    icon: TrendingUp,
    description: 'Recomendações para uso eficiente do sistema e melhores resultados.',
    content: [
      {
        subtitle: 'Manter Dados Atualizados',
        steps: [
          'Atualize os status dos negócios imediatamente após reuniões ou contatos.',
          'Mantenha contatos e empresas com dados corretos e completos.',
          'Registre motivos de perda com informações detalhadas e sinceras.',
          'Complete todos os campos obrigatórios e os opcionais quando possível.',
        ],
        tips: [
          'Dados atualizados geram relatórios e insights mais precisos.',
          'O Copiloto IA funciona significativamente melhor com dados frescos e completos.',
        ],
      },
      {
        subtitle: 'Registrar Atividades',
        steps: [
          'Documente todas as interações: reuniões, ligações, e-mails, visitas.',
          'Use a timeline de atividades para registrar notas importantes.',
          'Vincule atividades aos negócios correspondentes.',
          'O histórico completo ajuda na continuidade do relacionamento.',
        ],
        tips: [
          'Um bom histórico facilita a passagem de clientes entre vendedores.',
          'Atividades registradas contam para suas métricas de produtividade.',
        ],
      },
      {
        subtitle: 'Usar o Copiloto IA',
        steps: [
          'Consulte o Copiloto regularmente para sugestões e insights.',
          'Pergunte sobre status de clientes, negócios e métricas.',
          'Use para preparação antes de reuniões com clientes.',
          'O Copiloto aprende o contexto da sua base — quanto mais dados, melhor.',
        ],
      },
      {
        subtitle: 'Organizar Tarefas',
        steps: [
          'Crie tarefas para todos os follow-ups necessários — não confie na memória.',
          'Use prioridades corretamente: urgente apenas quando realmente urgente.',
          'Conclua tarefas assim que finalizadas — não acumule.',
          'Use o calendário para visualizar sua semana e distribuir carga.',
        ],
      },
      {
        subtitle: 'Revisar Pipeline Diariamente',
        steps: [
          'Reserve 15 minutos no início do dia para revisar o pipeline (comece pelo "Meu Dia").',
          'Identifique negócios que precisam de ação imediata.',
          'Mova negócios estagnados: avance, adie com justificativa ou encerre.',
          'Mantenha o funil limpo e realista — pipeline inchado gera previsões ruins.',
        ],
      },
      {
        subtitle: 'Usar Filtros e Busca',
        steps: [
          'Aprenda a usar os filtros avançados disponíveis em cada módulo.',
          'Combine filtros para análises específicas (ex: "meus negócios em negociação acima de R$10k").',
          'Use a busca global (Ctrl+K) para encontrar registros rapidamente.',
          'Salve combinações de filtro mentalmente para consultas frequentes.',
        ],
      },
      {
        subtitle: 'Aproveitar os Insights',
        steps: [
          'Verifique o módulo Insights pelo menos uma vez por semana.',
          'Aja nos alertas de negócios estagnados e tarefas atrasadas.',
          'Use propostas expirando como gatilho para recontato.',
          'Clientes inativos são oportunidades de reativação.',
        ],
      },
    ],
  },
  {
    id: 'seguranca',
    title: '22. Segurança e Privacidade',
    icon: Shield,
    description: 'Práticas de segurança, proteção de dados e conformidade LGPD.',
    content: [
      {
        subtitle: 'Proteja sua Senha',
        steps: [
          'Use senhas fortes com letras maiúsculas, minúsculas, números e símbolos.',
          'Mínimo de 8 caracteres é recomendado.',
          'Não compartilhe sua senha com ninguém.',
          'Altere sua senha periodicamente (recomendado a cada 90 dias).',
          'Não use a mesma senha de outros serviços.',
        ],
      },
      {
        subtitle: 'Encerrar Sessão',
        steps: [
          'Sempre clique em "Sair" no menu lateral ao terminar o trabalho.',
          'Especialmente importante em computadores compartilhados ou públicos.',
          'Sessões inativas são encerradas automaticamente após período de inatividade.',
          'Fechar o navegador não encerra a sessão — use o botão "Sair".',
        ],
      },
      {
        subtitle: 'Dados Sensíveis e LGPD',
        steps: [
          'Não exporte dados de clientes sem necessidade justificada.',
          'Cuidado ao compartilhar telas em reuniões — dados de clientes podem estar visíveis.',
          'Dados de clientes são confidenciais e protegidos pela LGPD.',
          'Use o sistema para armazenar dados — não mantenha planilhas paralelas.',
          'Respeite as políticas de privacidade da empresa.',
        ],
        warnings: [
          'Vazamento de dados pode ter consequências legais graves sob a LGPD.',
          'O uso indevido de dados de clientes é passível de sanções.',
        ],
      },
      {
        subtitle: 'Governança de Dados',
        steps: [
          'Dados são isolados por tenant (empresa) — cada organização vê apenas seus dados.',
          'Entidades jurídicas adicionam mais uma camada de segregação.',
          'Vendedores só acessam dados da sua carteira (modo restrito).',
          'Administradores podem intervir em dados de outros com justificativa obrigatória.',
        ],
      },
      {
        subtitle: 'Auditoria e Rastreabilidade',
        steps: [
          'Todas as ações no sistema são registradas automaticamente.',
          'Alterações em cadastros geram log de auditoria (campo, valor anterior, novo valor).',
          'Tentativas de acesso indevido são registradas com IP e horário.',
          'Intervenções administrativas exigem justificativa formal.',
          'O sistema mantém histórico completo para conformidade e disputas.',
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
      sections = sections.filter(s => ['pipeline', 'clientes', 'produtos', 'precos', 'pedidos', 'propostas', 'prospeccao', 'estoque'].includes(s.id));
    } else if (activeTab === 'produtividade') {
      sections = sections.filter(s => ['hoje', 'tarefas', 'insights', 'copiloto', 'emails'].includes(s.id));
    } else if (activeTab === 'comunicacao') {
      sections = sections.filter(s => ['whatsapp', 'bots', 'emails'].includes(s.id));
    } else if (activeTab === 'analise') {
      sections = sections.filter(s => ['relatorios', 'bi-avancado'].includes(s.id));
    } else if (activeTab === 'admin') {
      sections = sections.filter(s => ['configuracoes', 'integracoes', 'seguranca'].includes(s.id));
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
