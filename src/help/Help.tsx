import { HelpCircle, ListOrdered, ChevronRight } from "lucide-react";

interface HelpTopic {
  summary: string;
  content: JSX.Element;
  openByDefault?: boolean;
}

const TOPICS: HelpTopic[] = [
  {
    summary: "Rotina diária de serviços",
    openByDefault: true,
    content: (
      <>
        <p>
          Abra <strong>Lançamentos</strong>, escolha cliente, data, serviço, referência e valor.
        </p>
        <p>Para várias placas, cole uma por linha. Cada placa será gravada como um serviço separado.</p>
        <p>
          Use <strong>A fazer</strong>, <strong>Feito</strong> e <strong>Entregue</strong> para acompanhar o trabalho.
        </p>
        <button type="button" data-open-view="services" className="mt-1 self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2">
          Abrir lançamentos
        </button>
      </>
    )
  },
  {
    summary: "Serviços complementares",
    content: (
      <>
        <p>Marque "Adicionar serviços complementares" quando a mesma referência tiver mais de um serviço.</p>
        <p>
          Escolha o complementar, confirme o valor e clique em <strong>+</strong>. Os registros ficam separados.
        </p>
      </>
    )
  },
  {
    summary: "Fornecedor e custos",
    content: (
      <>
        <p>Marque "Este lançamento utiliza serviço de fornecedor", escolha fornecedor, serviço e custo.</p>
        <p>O custo é criado uma vez para cada placa ou referência, mesmo com serviços complementares.</p>
        <p>Em Fornecedores, gere a conta a pagar e registre baixas parciais ou totais.</p>
        <button type="button" data-open-view="suppliers" className="mt-1 self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2">
          Abrir fornecedores
        </button>
      </>
    )
  },
  {
    summary: "Fechamento e cobrança",
    content: (
      <>
        <p>
          Confira os serviços e abra <strong>Cobranças</strong>. Selecione cliente e período.
        </p>
        <p>O fechamento semanal normal vai de domingo até sexta-feira.</p>
        <p>Envie o acesso pelo WhatsApp ou compartilhe somente o relatório em PDF.</p>
        <button type="button" data-open-view="billing" className="mt-1 self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2">
          Abrir cobranças
        </button>
      </>
    )
  },
  {
    summary: "Pagamentos e baixas",
    content: (
      <>
        <p>Consulte contas abertas, atrasadas, parciais e quitadas no menu Pagamentos.</p>
        <p>A baixa pode ser parcial ou total. Informe data, valor e forma de pagamento.</p>
        <button type="button" data-open-view="payments" className="mt-1 self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2">
          Abrir pagamentos
        </button>
      </>
    )
  },
  {
    summary: "Links para clientes",
    content: (
      <>
        <p>O link da cobrança abre o portal sem exigir que o cliente digite credenciais.</p>
        <p>O acompanhamento mostra serviços e status apenas no período escolhido e não permite alterações.</p>
      </>
    )
  },
  {
    summary: "Comandos do teclado",
    content: (
      <div className="flex flex-col gap-2">
        {[
          ["Enter", "Avança para o próximo campo."],
          ["Espaço", "Marca ou desmarca o check selecionado."],
          ["Enter", "Na referência preenchida, adiciona a placa e mantém o foco."],
          ["Enter", "Na referência vazia, avança para o valor."],
          ["Shift + Enter", "Insere uma nova linha quando permitido."],
          ["Ctrl + F5", "Atualiza completamente após uma publicação."]
        ].map(([key, description], index) => (
          <div key={index} className="flex items-center gap-2 text-sm text-ink">
            <kbd className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs font-semibold">{key}</kbd>
            <span>{description}</span>
          </div>
        ))}
      </div>
    )
  },
  {
    summary: "Sincronização e segurança",
    content: (
      <>
        <p>Aguarde alguns segundos depois de salvar antes de fechar a página.</p>
        <p>
          Se aparecer erro de sincronização, anote o texto depois de <strong>Detalhe</strong>.
        </p>
        <p>Nunca compartilhe chaves do Supabase, tokens de API ou sua senha administrativa.</p>
      </>
    )
  },
  {
    summary: "Instalar no computador ou celular",
    content: (
      <>
        <p>
          No computador, use <strong>Instalar aplicativo</strong> quando o botão aparecer.
        </p>
        <p>
          No iPhone: Safari → Compartilhar → <strong>Adicionar à Tela de Início</strong>.
        </p>
      </>
    )
  },
  {
    summary: "Endereço e domínio profissional",
    content: (
      <>
        <p>O endereço atual continuará funcionando depois de adicionar um domínio próprio.</p>
        <p>
          Exemplos: <strong>gestordeadersan.com.br</strong> ou <strong>gestor.suaempresa.com.br</strong>.
        </p>
        <p>
          No Netlify: <strong>Domain management → Add a domain</strong>, depois siga a configuração de DNS.
        </p>
      </>
    )
  }
];

const SETUP_STEPS = [
  "Cadastre as tabelas de preços e os serviços.",
  "Cadastre os clientes e escolha a tabela de cada um.",
  "Cadastre suas formas de pagamento, principalmente o PIX.",
  "Se utilizar terceiros, cadastre o fornecedor e seus custos.",
  "Faça um lançamento de teste antes de iniciar a operação diária."
];

// Fase 18 da migracao React: "Ajuda e comandos" (vanilla #help, index.html).
// Conteudo 100% estatico - sem bridge, sem estado. Botoes "Abrir X"
// continuam so com data-open-view, mesmo listener generico ja existente.
// Accordion via <details>/<summary> nativos do navegador (zero JS de
// estado necessario).
export function Help() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <HelpCircle className="h-6 w-6" />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Manual do sistema</span>
            <h2 className="text-xl font-bold text-brand-ink">Ajuda e comandos</h2>
            <p className="text-sm text-muted">Consulte o fluxo diário, os atalhos e os cuidados para trabalhar com segurança.</p>
          </div>
        </div>
        <button
          type="button"
          data-open-view="services"
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Fazer lançamento
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-muted" />
          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-muted">Comece por aqui</span>
            <h3 className="text-base font-extrabold text-ink">Configuração inicial</h3>
          </div>
        </div>
        <ol className="flex flex-col gap-1.5 pl-5 text-sm text-ink" style={{ listStyleType: "decimal" }}>
          {SETUP_STEPS.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {TOPICS.map((topic) => (
          <details key={topic.summary} open={topic.openByDefault} className="group rounded-2xl border border-border bg-surface p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
              {topic.summary}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted [&_strong]:text-ink">{topic.content}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
