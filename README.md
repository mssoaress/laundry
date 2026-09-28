# Lavanderia Emanoel

Aplicação React + TypeScript + Vite para clientes, fichas, recebimentos, relatórios e notas. Os dados continuam no mesmo projeto Cloud Firestore. A migração não exige conversão, exclusão ou importação das coleções existentes.

## Executar e verificar

Requisitos: Node.js 22.18 ou superior e npm. O aplicativo depende de conexão com o Firebase e deve ser aberto por HTTP local ou HTTPS.

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5503. `npm start` também inicia o Vite. O servidor antigo do Live Server/Python não compila TypeScript: use o Vite durante o desenvolvimento. A execução normal utiliza o Firebase configurado em `src/data/repository.ts`: não cadastre dados fictícios nela.

```sh
npm run check          # TypeScript em modo estrito
npm test               # Regras financeiras e concorrência
npm run format:check   # Formatação
npm run build          # Gera a pasta dist para publicação
npm run preview        # Prévia do pacote compilado em http://127.0.0.1:5504
```

Para testar a interface **sem acessar o banco real**, com `npm run dev` iniciado:

```sh
npm run test:ui
npm run test:access
```

Para repetir os fluxos no pacote compilado, execute `npm run build`, inicie `npm run preview` em outro terminal e rode:

```sh
npm run test:ui:production
BASE_URL=http://127.0.0.1:5504 npm run test:access
```

Os testes usam o Google Chrome instalado, substituem o adaptador de persistência por um simulador e bloqueiam solicitações externas. A substituição existe apenas no processo de testes, sem conta de demonstração nem desvio de autenticação no código de produção. Capturas e PDFs ficam em `tests/artifacts/` e não são versionados. A verificação cobre também cadastro após resposta perdida, formulários durante sincronização, preços históricos, notas e navegação em 320, 390, 768 e 1440 pixels.

## Organização da migração

Todas as telas e formulários são componentes React. Estado, filtros, seleção e modais são controlados pela aplicação, sem funções globais em `window` ou substituição das telas por `innerHTML`. As assinaturas do Firebase são encerradas ao desmontar ou reconectar. As operações financeiras mantêm transações e identificadores de repetição, separados da interface. O HTML independente da nota permanece gerado por um módulo TypeScript próprio para preservar o desenho A5 na impressão.

## Quitação manual das fichas antigas

Nenhum pagamento antigo é apagado, e nenhuma ficha antiga é marcada automaticamente. Uma ficha sem os novos campos começa como não paga.

No detalhe do cliente, **Marcar como paga** realiza uma operação atômica:

1. Calcula o saldo ainda não vinculado à ficha.
2. Aproveita recebimentos já registrados que ainda não estejam vinculados a outras fichas.
3. Registra somente a diferença, quando houver, vincula os valores e marca a ficha com um clique, sem confirmação adicional.

Exemplo: cliente com duas fichas de R$ 100 e R$ 200, e pagamento antigo de R$ 150. Todas começam não pagas. Marcar a primeira usa R$ 100 já recebidos, sem criar receita. Marcar a segunda usa os R$ 50 restantes e registra R$ 150 novos. O total recebido passa a R$ 300, e não a R$ 450.

**Marque como paga quando a diferença tiver sido recebida.** Para receber apenas parte, use Registrar pagamento e informe o valor e a data. Depois, marque a ficha quando ela tiver sido quitada.

O saldo financeiro considera todos os pagamentos ativos. A marcação das fichas exige a conferência manual escolhida pelo proprietário; por isso, durante a conferência, o total das fichas ainda não marcadas pode ser maior que o saldo financeiro. O detalhe informa os recebimentos disponíveis para vínculo.

- **Desmarcar paga / Desvincular pagamento:** libera os vínculos da ficha, preserva os recebimentos e devolve a ficha à seleção da nota.
- **Estornar pagamento:** exige motivo, mantém o registro histórico, retira seu valor dos totais e reabre as fichas relacionadas. Para corrigir valor ou data, estorne e registre o pagamento correto.
- **Cancelar ficha:** mantém o histórico, remove a ficha dos totais e libera seus vínculos. Há restauração no detalhe.
- **Arquivar cliente ou lavado:** preserva fichas e pagamentos. Clientes arquivados continuam nos totais, relatórios e pendências; ficam ocultos na lista padrão e não recebem novas fichas.

## Painel semanal e interface

O painel mostra exclusivamente a semana local de **segunda a domingo**, incluindo os dois dias. Todos os indicadores, o gráfico, os clientes em movimento e as últimas fichas usam o mesmo intervalo. Recebimentos são filtrados pela data do pagamento; lançamentos e peças, pela data da ficha. Cancelamentos e estornos não entram nos totais. Não se apresenta um saldo histórico sob o rótulo de saldo semanal.

Os relatórios mantêm a consulta mensal, por intervalo e a opção **Todo o histórico**. O diretório de clientes oferece busca, filtros por situação, ordenação por nome ou saldo e formulário integrado de edição. No detalhe, as abas separam fichas em aberto, fichas pagas, pagamentos e histórico. Ações secundárias ficam no menu de três pontos.

## Notas e relatórios

A seleção e a geração da nota excluem fichas quitadas. Antes de gerar, a aplicação relê a conta no servidor e revalida a seleção. Em ficha parcialmente vinculada, a nota discrimina total, pagamento vinculado e saldo. A nota abre em outra aba, preservando o painel. O modelo de impressão segue a folha A5 da lavanderia, com logo centralizado, tabelas azuis de cantos arredondados, anotações, informações extras, contatos do WhatsApp e o versículo no rodapé. As linhas exibem descrição, lavado, quantidade, data e saldo, com preço unitário e pagamentos parciais discriminados. O total considera somente as fichas selecionadas ainda em aberto. Em notas extensas, a tabela continua nas páginas seguintes com o cabeçalho repetido. Ao imprimir, desative os cabeçalhos e rodapés automáticos do navegador. O botão usa a impressão do navegador para imprimir ou salvar em PDF; não envia mensagem ou arquivo automaticamente.

O relatório inclui recebimentos mesmo sem fichas no período, e o seletor de anos considera fichas e pagamentos. A coluna **Saldo geral a receber** é histórica, enquanto Lançado e Recebido seguem o período. **Quitar fichas do período** restringe a seleção às fichas desse intervalo.

## Estrutura e dados

- `src/App.tsx` e `src/main.tsx`: inicialização, acesso, navegação e estrutura.
- `src/pages/`: painel, clientes, detalhe, fichas, relatórios, pendências e lavados.
- `src/components/`: formulários, modais, cartões e controles reutilizáveis.
- `src/hooks/useApp.tsx`: estado compartilhado, sincronização e controle de operações.
- `src/domain/index.ts`: cálculos em centavos, validações e vínculo de pagamentos.
- `src/services/operations.ts`: cadastro, edição, quitação, cancelamento e estorno.
- `src/services/note.ts` e `src/services/print.ts`: nota A5 e impressão.
- `src/data/repository.ts`: SDK npm do Firebase e protocolo transacional.
- `src/types.ts`: modelos de clientes, fichas, recebimentos e serviços.
- `src/styles.css`, `public/img/`: paleta azul, estilos responsivos e imagens.
- `tests/`: testes financeiros, concorrência, interface e acesso local.
- `dist/`: pacote gerado pelo Vite; não editar nem versionar.

Coleções existentes mantidas:

- `clientes`: `nome`, `tel`; novos campos `revision`, `arquivado` e datas de alteração.
- `lancamentos`: `cid`, `peca`, `qtd`, `valor`, `data`, `lavado`; novos campos `lavadoId`, `paga`, `pagaEm`, `cancelada` e datas de alteração.
- `pagamentos`: `cid`, `valor`, `data`; novos campos `alocacoes: [{fid, centavos}]`, `origem`, `estornado`, `estornadoEm`, `motivoEstorno`.
- `lavados`: `nome`, `valor`; novo campo `arquivado`.

Campos legados monetários permanecem em reais para compatibilidade. Cálculos e vínculos usam centavos inteiros. Datas de movimento são datas locais, sem conversão indevida para UTC. O horário técnico de alteração é registrado pelo servidor.

Cada escrita financeira relê a conta no servidor e participa da revisão transacional do cliente. Uma alteração concorrente obriga nova leitura; operações com valores desatualizados são recusadas. Uma quitação repetida de ficha já paga não lança outro pagamento. Quitações em lote são atômicas por cliente; se houver falha intermediária, a interface informa quantos clientes já foram concluídos.

## Publicação e limites conhecidos

Execute `npm run build` e publique o conteúdo de `dist/`. `vercel.json` está configurado para Vite, com build, diretório de saída, cabeçalhos básicos e revalidação de cache. A raiz do código-fonte não deve ser publicada como a antiga aplicação estática. Esta alteração não publica automaticamente o site.

Após publicar, recarregue o aplicativo em **todos os dispositivos**. Versões antigas não participam do protocolo de revisão e não devem continuar gravando em paralelo.

A autenticação local por senha foi mantida a pedido do proprietário. Ela **não é autorização no servidor**. Firebase Authentication, usuários autorizados, regras de leitura/escrita e validação no Firestore continuam sendo a etapa de segurança a executar depois. Não há mudança automática nas regras implantadas.

Os testes não consultam nem modificam o Firebase de produção. Os testes de concorrência verificam o adaptador com uma implementação transacional em memória, não um emulador Firebase. Confirme as regras implantadas e compatibilidade das transações em ambiente de homologação antes da publicação.

As listas têm paginação visual e agregações reutilizadas por atualização. Para preservar os saldos legados completos, a carga inicial ainda lê as quatro coleções; paginação de consultas e agregados persistidos são uma evolução necessária para bases muito grandes. Não se faz uma soma parcial de páginas como se fosse o saldo completo.

**Exportar backup** baixa os dados carregados em JSON. Exporte quando o indicador estiver Sincronizado e sem gravações pendentes. É uma cópia manual, não substitui backup automatizado do Firestore ou uma política de restauração.
