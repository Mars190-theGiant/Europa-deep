# Abismo de Europa (versão HTML)

Terror lo-fi de exploração submarina no oceano escondido sob o gelo de Europa, lua de Júpiter. Protótipo para o NASA Space Apps.

Você pilota o submersível **TÉTIS-7**. Cuida de oxigênio, energia, casco e sanidade, explora quatro zonas do oceano e escaneia criaturas e estruturas. **As criaturas são ficção. Os dados que aparecem em cada scan são reais**, de missões da NASA (Europa Clipper, Galileo, Juno, Hubble, James Webb).

O jogo inteiro roda no navegador: um arquivo `index.html`, a biblioteca Three.js em `lib/` e a trilha em `audio/`. Não precisa instalar nada.

## Jogar online

https://mars190-thegiant.github.io/Europa-deep/

## Como abrir

**Mais fácil:** abra `abismo_europa_completo.html` com dois cliques. É um arquivo só (6,5 MB) com o Three.js e as 4 músicas embutidos. Pode mandar por WhatsApp, pendrive ou e-mail que funciona sozinho, com toda a trilha.

**Do jeito certo (com toda a trilha e os filtros de áudio):** sirva a pasta por HTTP.

```bash
cd Europa-deep
python3 -m http.server 8000
# abra http://localhost:8000 no navegador
```

**Jeito rápido:** dar dois cliques no `index.html` também funciona. Nesse modo (`file://`) o navegador não deixa carregar o áudio pelo Web Audio, então a música toca pelo modo simples, com crossfade de volume mas sem o filtro de “tensão”.

**itch.io:** compacte o conteúdo da pasta (`index.html`, `lib/`, `audio/`) num `.zip`, com o `index.html` na raiz. No itch.io crie um projeto do tipo *HTML*, envie o zip e marque “This file will be played in the browser”. Tamanho de janela sugerido: 1280 × 800. Se quiser deixar o zip menor, só estes 4 áudios são usados (em `.ogg` e `.mp3`): `abismo_europa_vibrante_ganza`, `abismo_europa_calma`, `abismo_europa_animada`, `abismo_europa_ambiente`.

Precisa de um navegador com WebGL (qualquer Chrome, Edge, Firefox ou Safari recente). Funciona no celular, mas é melhor no computador e com fones.

## Como jogar

**Objetivo:** fazer **6 descobertas**, com **pelo menos uma em cada uma das 4 zonas**, e voltar para **acoplar à base** na Interface gelo-oceano antes do fim do **ciclo 12**.

- Cada **ciclo de mergulho** tem **5 turnos**. Quase toda ação gasta um turno.
- No fim do ciclo (botão **ENCERRAR CICLO** ou Enter), o submersível gasta 12% de O₂ e 6 de energia (o gerador dá +10, os sistemas gastam 16), e a pressão tira casco e sanidade. Quanto mais fundo, pior. Depois vem um evento aleatório.
- Energia zerada no fim do ciclo é **blecaute**. Dois blecautes seguidos e acabou.

| Tecla | Ação | Custo | Efeito |
|---|---|---|---|
| 1 | Navegar e explorar | 8 energia | O submersível avança e pode achar um contato |
| 2 | Escanear contato | 6 energia | Identifica o contato e mostra um dado real da NASA |
| 3 | Pulso de sonar | 3 energia | Diz quantas coisas faltam na zona. Não gasta turno |
| 4 | Eletrólise | 14 energia | +18% O₂ |
| 5 | Reparar casco | 10 energia | +16% casco |
| 6 / 7 | Lastro: descer / subir | 10 / 8 energia | Muda de zona |
| 8 | Recarregar na fonte | grátis | Só no campo hidrotermal: +30 energia, −6% casco |
| 9 | Falar com a base | grátis | +sanidade (diálogo com a base Conamara) |
| 0 | Apagar as luzes | grátis | +8 sanidade, +4 energia… se nada aparecer no vidro |
| A | Acoplar à base | grátis | Termina a missão (precisa do objetivo cumprido, na Interface) |

Outras teclas: **D** abre o diário, **M** liga e desliga o som, **Enter** encerra o ciclo.

Na cabine 3D você também pode **arrastar para olhar em volta** e **clicar nos terminais**: MOTOR, SCANNER, SONAR, O₂, REPARO e FIM CICLO no painel da frente; RÁDIO, LUZES e DIÁRIO na parede da esquerda; DESCER, SUBIR, FONTE e ACOPLAR na parede da direita.

**As 4 zonas** (profundidade a partir da superfície do gelo):

1. Interface gelo-oceano, 20,4 km. Teto de gelo, pingentes de sal.
2. Coluna d’água, 52 km. Nem chão nem teto.
3. Campo hidrotermal, 97,8 km. Chaminés quentes no fundo. Dá para recarregar energia.
4. Fenda abissal, 112,6 km. A pressão passa de 1.400 bar. A música muda.

**Sanidade abaixo de 45%:** aparecem silhuetas no sonar, batidas no casco, vultos passando pela janela, a imagem distorce e o texto do log começa a falhar. Às vezes a música corta de repente, ficam só as bolhas e o casco rangendo… e alguma coisa chega no vidro.

**Finais:** volta com sucesso (e uma versão estranha se você voltar com a sanidade muito baixa), falta de ar, casco esmagado, escuridão total, perder a cabeça, ou o cabo cortado por tempo.

## Onde ficam os dados da NASA

Tudo no `index.html`, no começo do script:

- `TARGETS`: os 16 alvos de scan (4 por zona). Cada um tem a descrição fictícia (`desc`), o dado real (`fact`) e a fonte (`src`).
- `FACTS`: dados reais que aparecem no começo de cada ciclo.
- `G_EUROPA` e `ICE_KM`: gravidade real de Europa (1,315 m/s²) e a espessura de gelo usada no jogo (20 km, dentro da estimativa da NASA de 15 a 25 km). A pressão mostrada no HUD é calculada com esses valores.

Dados usados e de onde vêm:

| Dado | Fonte |
|---|---|
| Gelo de 15 a 25 km de espessura; radar REASON mede o gelo | NASA, Europa Clipper |
| Conamara Chaos: placas de gelo que se moveram e congelaram de novo | NASA/JPL, sonda Galileo |
| Sal de cozinha na Tara Regio (2019) e CO₂ no mesmo lugar (2023) | NASA, Hubble e James Webb |
| Indícios de plumas de água (2012, 2016) e assinatura de pluma nos dados de 1997 | NASA, Hubble e Galileo |
| O oceano pode ter o dobro da água dos oceanos da Terra | NASA Science |
| Campo magnético induzido indica oceano salgado | NASA/JPL, magnetômetro da Galileo |
| Órbita de 3,5 dias e aquecimento por maré | NASA Science |
| Cerca de 12 kg de oxigênio por segundo produzidos na superfície | NASA, sonda Juno |
| Três ingredientes para a vida: água, química e energia | NASA, Europa Clipper |
| Lançamento em 14/10/2024 (Falcon Heavy, Kennedy), chegada em abril de 2030, 49 passagens, até 25 km | NASA, Europa Clipper |
| 9 instrumentos + experimento de gravidade; E-THEMIS e MISE | NASA, Europa Clipper |
| ~5,4 Sv de radiação por dia; cofre de alumínio e zinco | NASA, Europa Clipper |
| Oceano de 60 a 150 km de profundidade | NASA Science |
| Galileo: lançada em 1989, chegou em 1995, jogada em Júpiter em 2003 para proteger Europa | NASA/JPL, Galileo |
| Superfície jovem, de 40 a 90 milhões de anos | NASA Science |
| Placa com o poema “In Praise of Mystery”, de Ada Limón, e 2,6 milhões de nomes | NASA, Europa Clipper |
| Diâmetro de ~3.100 km; descoberta em 1610; sinal leva 33 a 53 min até a Terra; superfície abaixo de −160 °C; gravidade de ~13% da Terra; mais de 90 luas de Júpiter | NASA Science |
| Painéis de ~30 m; passagem por Marte (mar/2025) e pela Terra (dez/2026) | NASA, Europa Clipper |

Para conferir ou se aprofundar: <https://science.nasa.gov/jupiter/jupiter-moons/europa/> e <https://europa.nasa.gov/>.

## Trilha sonora

Arquivos em `audio/`, controlados por um AudioManager em Web Audio com quatro “snapshots” e crossfade entre eles:

| Estado | Música | Quando |
|---|---|---|
| Título | `abismo_europa_vibrante_ganza` (versão mais recente, ganzá mais baixo) | Tela de abertura |
| Calmo | `abismo_europa_calma` | Falar com a base, apagar as luzes, fim de ciclo, diário, final de vitória |
| Comum | `abismo_europa_animada` (sem chocalho) | Exploração normal |
| Tensão | `abismo_europa_ambiente` com filtro passa-baixa | Fenda abissal, sanidade abaixo de 45%, recurso crítico, derrota |
| Silêncio | nenhuma música | Uns 4 segundos antes de cada susto: só bolhas e o casco rangendo |

Os efeitos (bolhas, rangido do casco, batidas, sonar, motor, susto) são gerados na hora com Web Audio, sem arquivos.

## Como o código está organizado

Um único `index.html`, em blocos comentados, que seguem o plano do projeto Unity para facilitar a migração depois:

- **Dados** (`CONFIG`, `ZONES`, `TARGETS`, `ACTIONS`, `EVENTS`, falas): no Unity viram ScriptableObjects.
- **Estado e turnos** (`S`, `doAction`, `endCycle`, `checkEnd`, `finish`): o GameManager. Lógica de recursos, turnos, eventos e sanidade portada do protótipo Jezero-9, com ciclos de mergulho no lugar dos sóis.
- **Áudio** (`AudioSys`, `sfx`): o AudioManager com snapshots.
- **3D** (Three.js): cabine em primeira pessoa com terminais clicáveis, oceano com névoa, neve marinha, feixe do farol, fontes hidrotermais com plumas, teto de gelo. Tudo é renderizado em 320×180 e passa por um shader com dithering Bayer, granulação, scanlines, aberração cromática e distorção que cresce quando a sanidade cai.
- **HUD 2D**: barras, câmera externa (uma segunda câmera 3D com filtro verde), sonar, log com efeito de digitação e falhas, telas de título, fim e diário.

Three.js r128 (licença MIT) está em `lib/three.min.js`. Se o arquivo faltar, a página tenta carregar do CDN jsDelivr.

Tudo é original: história, criaturas, visual e trilha. Só o gênero (terror de submarino lo-fi) é inspiração.
