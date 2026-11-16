# Abismo de Europa

[English](README.md) · **Português**

Jogo educativo de projeto de missão espacial para o NASA Space Apps (desafio **Space Mission Design Game**). Você projeta uma missão para o oceano escondido sob o gelo de Europa, lua de Júpiter: escolhe o destino, o foguete, a trajetória e a equipe dentro de uma verba e de uma carga limitadas, monta a base e o submarino, e mergulha para descobrir se o projeto funciona.

**Jogar:** <https://mars190-thegiant.github.io/Europa-deep/>

| Página | O que é |
|---|---|
| [`/`](https://mars190-thegiant.github.io/Europa-deep/) | Página inicial: o problema, globo 3D de Europa com filtros, simulador de projetos prontos com gráficos e quiz |
| [`/jogo.html`](https://mars190-thegiant.github.io/Europa-deep/jogo.html) | O jogo (versão 2, portada do projeto Unity v2) |
| [`/classico/`](https://mars190-thegiant.github.io/Europa-deep/classico/) | A primeira versão, com cabine em primeira pessoa e clima de mistério |

**Idiomas:** o site e o jogo abrem em inglês. O botão **EN · PT** no topo (ou `?lang=pt` no endereço) troca para português, e o navegador lembra a escolha. A versão clássica é só em português.

Os dados científicos são reais (NASA, JPL, Hubble, James Webb, Juno, Galileo). As criaturas e as pessoas são ficção.

## Como jogar

1. **Projeto.** Escolha quem você é (Luísa Galvão ou Téo Junqueira), o destino no mapa (4 missões, do fácil ao difícil), o foguete (Atlas V 551, Falcon Heavy, SLS), a trajetória (direta, MEGA, VEEGA) e a equipe. Foguete e salários custam verba; tudo pesa no foguete.
2. **Planejamento**, entre um ciclo e outro: 8 módulos da base, 6 upgrades do submarino, 8 instrumentos reais da Europa Clipper pagos com dados, 6 células de energia para dividir, conversas com a equipe.
3. **Mergulho:** 12 ciclos de 5 turnos. Navegar, escanear, sonar, eletrólise, reparo, descer e subir entre 4 zonas, recarregar na fonte hidrotermal, falar com a base, descansar, sair em **EVA** com o astronauta (precisa da eclusa) e acoplar.
4. **Imprevistos** sorteados por uma **floresta aleatória** de 9 árvores de decisão que olham o estado da missão e votam; a missão escolhida puxa os votos para os temas dela. Algumas escolhas abrem um segundo cenário.
5. **Fim:** nota de S a D, gráfico dos recursos ao longo da missão, uma leitura do que os números querem dizer e o resumo “Como suas escolhas moldaram a missão”.

Teclado: 1–0, E e A para as ações, Enter encerra o ciclo, D diário, M mapa, S som. Na EVA: WASD ou setas, Espaço e C, Shift, E. No celular tudo é por toque, com joystick na EVA; melhor com o celular deitado.

## Simulador (página inicial)

Cinco projetos prontos rodam 200 vezes cada, com as mesmas regras do jogo (`src/engine.js`) e um piloto automático que às vezes erra (`src/sim.js`). A página mostra a taxa de sucesso, os recursos médios por ciclo, como as missões terminaram, a comparação entre os projetos e uma interpretação em texto: o que é bom, o que é arriscado e o que limita cada projeto. O botão “Jogar com este projeto” abre o jogo com aquela escolha já preenchida (`jogo.html?projeto=clipper`).

## Como o código está organizado

Não é um HTML único: são módulos JavaScript, dados em JSON, Three.js para o 3D e HTML/CSS para a interface 2D.

```
index.html          página inicial          css/site.css   src/landing.js
jogo.html           jogo                    css/game.css   src/game.js
css/base.css        estilos compartilhados
src/engine.js       regras: recursos, ações, fim de ciclo, eventos, finais, pontuação (portado do GameManager do Unity)
src/forest.js       floresta aleatória que escolhe os cenários (portado de ScenarioForest.cs)
src/sim.js          projetos prontos, piloto automático e interpretação dos resultados
src/world3d.js      cenas Three.js: globo de Europa com filtros, Júpiter, base, submarino montável, oceano por zona, EVA
src/map2d.js        mapa da superfície e corte gelo/oceano em Canvas 2D
src/charts.js       gráficos em Canvas 2D
src/i18n.js         idioma (EN padrão, PT opcional), textos estáticos e mescla do en.json
src/audio.js        trilha com crossfade (Web Audio) e efeitos gerados na hora
data/en.json        camada em inglês de todos os dados (mesclada por id em loadDB)
data/*.json         missões, tripulação, foguetes e trajetórias, 20 cenários, zonas, alvos, eventos, módulos, upgrades, pesquisa, textos
img/crew/           retratos da tripulação
audio/              trilha original (ogg e mp3)
lib/three.min.js    Three.js r128 (MIT)
classico/           a primeira versão do jogo
```

Os arquivos em `data/` foram convertidos do projeto Unity (`DefaultContent.cs` e `DefaultContent.MissionDesign.cs`). Para mudar um número ou um texto, edite o JSON (o texto em inglês fica em `data/en.json`; os textos da interface ficam no código, em chamadas `tr('português', 'English')`).

## Rodar localmente

Os módulos JavaScript precisam de um servidor (abrir o arquivo com dois cliques não funciona):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Trilha sonora

| Estado | Música |
|---|---|
| Título | `abismo_europa_vibrante_ganza` |
| Projeto e planejamento | `abismo_europa_calmo_mergulho` |
| Diálogos, descanso, vitória | `abismo_europa_calma` |
| Exploração e EVA | `abismo_europa_animada_maracas` |
| Fenda abissal, recurso crítico, derrota | `abismo_europa_ambiente` com filtro passa-baixa |

## Dados usados

Gelo de 15 a 25 km e radar REASON; oceano de 60 a 150 km com o dobro da água da Terra; Conamara Chaos (Galileo); sal na Tara Regio (Hubble, 2019) e CO₂ (James Webb, 2023); plumas (Hubble 2012–2016, Galileo 1997, Keck 2019); campo magnético induzido (Galileo); órbita de 3,5 dias e aquecimento por maré; 12 kg/s de oxigênio (Juno); lançamento da Europa Clipper em 14/10/2024 num Falcon Heavy, passagens por Marte (2025) e Terra (2026), chegada em 2030, 49 sobrevoos; 7 dos 9 instrumentos (REASON, E-THEMIS, MISE, ECM, MASPEX, Europa-UVS, EIS) e o experimento de gravidade e rádio; radiação de 5,4 Sv/dia; Galileo lançada em 1989, chegada em 1995, jogada em Júpiter em 2003; superfície de 40 a 90 milhões de anos; placa com o poema de Ada Limón; Thera Macula (Nature, 2011); fontes hidrotermais descobertas pelo Alvin em 1977 (WHOI).

Fontes: <https://science.nasa.gov/jupiter/jupiter-moons/europa/> e <https://europa.nasa.gov/>.
