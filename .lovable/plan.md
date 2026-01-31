
# Diagnóstico: Timeline e Notas não aparecem

## Situação Atual

Analisei o código e confirmei que **as tabs Timeline e Notas EXISTEM no código fonte**:

```
Pipeline.tsx (linhas 483-509):
├── TabsList com grid-cols-7 (7 colunas)
├── TabsTrigger value="dados"
├── TabsTrigger value="atividades" ← TIMELINE
├── TabsTrigger value="notas" ← NOTAS RÁPIDAS
├── TabsTrigger value="propostas"
├── TabsTrigger value="participantes"
├── TabsTrigger value="historico"
└── TabsTrigger value="whatsapp"
```

Os componentes também estão corretos:
- `src/components/timeline/ActivityTimeline.tsx` - implementado
- `src/components/notes/QuickNotes.tsx` - implementado
- Importações no Pipeline.tsx - presentes

## O Problema

A screenshot mostra apenas **5 tabs** (Dados, Propostas, Equipe, Histórico, WhatsApp), enquanto o código define **7 tabs**.

**Diagnóstico:** O preview está exibindo uma versão anterior do código que não inclui as novas tabs.

## Solução

O problema é de sincronização entre o código e o preview. A solução é:

1. **Forçar recompilação** - Fazer uma pequena alteração no Pipeline.tsx para garantir que o Vite recompile o componente
2. **Validar no browser** - Limpar cache ou fazer hard refresh

### Alteração Técnica

Adicionar um comentário ou fazer pequeno ajuste no arquivo para forçar rebuild:

```typescript
// Linha 483: Garantir que TabsList tenha exatamente 7 colunas
<TabsList className="grid w-full grid-cols-7">
```

---

## Após Correção - O Que Será Exibido

| Tab | Conteúdo |
|-----|----------|
| **Dados** | Formulário de edição do negócio |
| **Timeline** | Histórico cronológico (atividades, mudanças de etapa, tarefas) |
| **Notas** | Sistema de notas rápidas multi-usuário |
| **Propostas** | Lista de propostas vinculadas |
| **Equipe** | Participantes do negócio |
| **Histórico** | Auditoria detalhada de campos |
| **WhatsApp** | Chat integrado |

---

## Complexidade

**Baixa** - Apenas forçar recompilação/refresh para sincronizar preview com código
