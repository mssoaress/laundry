# Lavanderia Emanoel

Aplicação estática para clientes, fichas, recebimentos, relatórios e notas. A interface usa JavaScript, HTML e CSS, com persistência no Cloud Firestore.

## Executar e verificar

Requisitos: Node.js 20 ou superior, npm; Python 3 para o servidor local. O aplicativo depende de conexão com o Firebase e deve ser aberto por HTTP local ou HTTPS.

```sh
npm ci
npm run check
npm test
npm start
```

Abra http://localhost:5501. Essa execução normal utiliza o projeto Firebase configurado em `repository.js`: não cadastre dados fictícios nela.

Para testar a interface **sem acessar o banco real**, com o servidor iniciado:

```sh
npm run test:ui
```

O teste usa o Google Chrome instalado, intercepta o adaptador de persistência e bloqueia solicitações externas. Capturas ficam em `tests/artifacts/` e não são versionadas.

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

- `app.js`: interface, navegação, comandos, relatórios e notas.
- `note.js`: documento de impressão A5, com estilo independente da interface.
- `domain.js`: cálculos em centavos, validações, vínculo de pagamentos e regras da nota.
- `repository.js`: Firebase, consultas e operações transacionais.
- `index.html`, `style.css`, `img/`: estrutura e apresentação.
- `tests/`: testes de domínio, concorrência do adaptador e fluxos no navegador.

Coleções existentes mantidas:

- `clientes`: `nome`, `tel`; novos campos `revision`, `arquivado` e datas de alteração.
- `lancamentos`: `cid`, `peca`, `qtd`, `valor`, `data`, `lavado`; novos campos `lavadoId`, `paga`, `pagaEm`, `cancelada` e datas de alteração.
- `pagamentos`: `cid`, `valor`, `data`; novos campos `alocacoes: [{fid, centavos}]`, `origem`, `estornado`, `estornadoEm`, `motivoEstorno`.
- `lavados`: `nome`, `valor`; novo campo `arquivado`.

Campos legados monetários permanecem em reais para compatibilidade. Cálculos e vínculos usam centavos inteiros. Datas de movimento são datas locais, sem conversão indevida para UTC. O horário técnico de alteração é registrado pelo servidor.

Cada escrita financeira relê a conta no servidor e participa da revisão transacional do cliente. Uma alteração concorrente obriga nova leitura; operações com valores desatualizados são recusadas. Uma quitação repetida de ficha já paga não lança outro pagamento. Quitações em lote são atômicas por cliente; se houver falha intermediária, a interface informa quantos clientes já foram concluídos.

## Publicação e limites conhecidos

A pasta pode ser servida como site estático. `vercel.json` define cabeçalhos básicos e revalidação de cache. Esta alteração não publica automaticamente o site.

Após publicar, recarregue o aplicativo em **todos os dispositivos**. Versões antigas não participam do protocolo de revisão e não devem continuar gravando em paralelo.

A autenticação local por senha foi mantida a pedido do proprietário. Ela **não é autorização no servidor**. Firebase Authentication, usuários autorizados, regras de leitura/escrita e validação no Firestore continuam sendo a etapa de segurança a executar depois. Não há mudança automática nas regras implantadas.

Os testes não consultam nem modificam o Firebase de produção. Os testes de concorrência verificam o adaptador com uma implementação transacional em memória, não um emulador Firebase. Confirme as regras implantadas e compatibilidade das transações em ambiente de homologação antes da publicação.

As listas têm paginação visual e agregações reutilizadas por atualização. Para preservar os saldos legados completos, a carga inicial ainda lê as quatro coleções; paginação de consultas e agregados persistidos são uma evolução necessária para bases muito grandes. Não se faz uma soma parcial de páginas como se fosse o saldo completo.

**Exportar backup** baixa os dados carregados em JSON. Exporte quando o indicador estiver Sincronizado e sem gravações pendentes. É uma cópia manual, não substitui backup automatizado do Firestore ou uma política de restauração.
