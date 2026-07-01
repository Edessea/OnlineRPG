# Online RPG

## 1. Resumen Del Juego
- **Título:** [Online RPG]
- **Género:** RPG basado en texto y multijugador online
- **Plataforma:** Web 
- **Concepto:** Es una web en la que se puede jugar a un juego multijugador online de rol basado en texto. Una IA (Gemini) hace de Game Master. Consiste en un chat donde los jugadores puede conversar, planear y hacer sus movimientos mientras la IA se ocupa de manejar la historia, los NPCs, etc.

## 2. Mecánicas y jugabilidad principal
- **Acciones del jugador:** 
 - Al entrar a la web, entregan su ficha de personaje. 
 - Si has iniciado tú la partida, estarás solo en una sala. Para lograr que se unan más jugadores, deberán clicar en el botón "Unirse a una partida" e introducir el enlace de la sala. Si no la has iniciado tú, clica en "Unirse a una partida" e introduce el enlace de la sala que te han dado.
 - El orden de turnos será según el orden en el que los jugadores hayan entrado a la partida. Será el mismo durante toda la partida.
 - Planean con otros jugadores los movimientos mediante el chat. 
 - Hacen sus acciones (hay dos tipos de mensaje: uno en el cual comunicas una acción, y otro que es solo para comunicarse con otros jugadores). 
 - Una vez hayas enviado tu movimiento, debes tirar los dados. Esto se hace presionando un botón que genera un número aleatorio; este número se manda al chat para que todos los jugadores puedan verlo. Una vez llevadas a cabo estas dos acciones (Enviar tu acción, tirar los dados) la IA explica el desenlace de la acción y pasa al siguiente jugador.
- **Acciones de la IA:**
  - Se ocupa de poner en contexto a los jugadores.
  - Maneja la historia.
  - “Tira los dados” de los NPCs y juega sus movimientos. Eso sí, el resultado de los dados de NPCs no se publica al chat.
  - Controla los valores (fuerza, XP, etc) de los jugadores y los va actualizando.
  - En momentos críticos, genera una imagen de lo que está sucediendo.
  - Decide cómo y cuando finalizar la partida.
  - Indica a los jugadores qué dado tirar. El botón de "dado" debe ajustarse a la decisión de la IA.

- **Loop del juego:** 
 - Comienza la partida, la IA describe la situación inicial y da lugar a la primera ronda de acciones.
 - Los jugadores envían sus acciones y tiran sus dados. No hay un límite de tiempo por acción. Una vez que un jugador ha enviado su acción y tirado sus dados, la IA explica el desenlace de la acción y pasa al siguiente jugador.
 - Se repiten las rondas hasta que se cumplan las condiciones de victoria o derrota.

- **Condiciones de victoria/derrota:**
  - **Victoria:** Puesto que cada partida es diferente, la IA definirá la situación de victoria.
  - **Derrota:** Al igual que en la victoria, la IA definirá la situación de derrota.
- **Mecánicas clave:** 
  - **Tirada de dados:** Cada jugador tiene una tirada de dados por turno, que se utiliza para determinar el éxito de sus acciones. La tirada se realiza presionando un botón que genera un número aleatorio; este número se manda al chat para que todos los jugadores puedan verlo.
  - **Tipos de mensajes:** Hay dos tipos de mensaje: uno en el cual comunicas una acción, y otro que es solo para comunicarse con otros jugadores.

## 3. Controles
No hay controles puesto que es un juego basado en texto.

## 4. Estilo visual y estética
- **Tema:** Un aesthetic acogedor y oscuro. Algo entre dark mode y un estilo acogedor.
- **Colores:** Un color sepia con letras negras. 
- **Imágenes:** Se pueden usar imágenes de Gemini para ilustrar la situación. Genera una imagen de lo que está sucediendo. Además, cuando un jugador manda un mensaje, se muestra su foto de perfil/imagen del personaje y su nombre.
- **Animaciones:** No hay animaciones.

## 5. Pantallas
- **Pantalla Inicial:** Un título que dice “Rol Online” y dos botones: “Iniciar partida” y “Unirse a una partida”. Al presionar “Iniciar partida”, se crea una sala y se genera un enlace único. Al presionar “Unirse a una partida”, se abre un campo para pegar un enlace. 
- **Pantalla de Personaje:** Aquí al jugador se le pedirá que registre información sobre su personaje: Nombre, Raza, Clase, etc. Muy recomendable copiar y pegar de un documento escrito previamente. 
- **Pantalla del juego:** La pantalla del juego consiste en un chat. Hay un área para escribir mensajes, un área para ver los mensajes de la IA y de otros jugadores, y un botón para tirar los dados. Además, hay un botón que muestra la ficha de personaje con los datos del jugador actuales, sin historial de cambios.
- **Pantalla de fin del juego:** Pantalla que muestra que la partida ha terminado y un botón que dice “Jugar de nuevo”.

## Arquitectura
  - Se utilizará Next.js como framework full-stack (React en el frontend y API Routes en Node.js para el backend).
  - Todo el almacenamiento (estado de la campaña, estadísticas del jugador, etc.) se guardará en una base de datos externa: Supabase DB.
  - El servidor se desplegará a través de DigitalOcean App.
  - La campaña se puede pausar por un tiempo ilimitado y reanudarse después. Es decir, los jugadores pueden dejar de jugar y volver a entrar cuando quieran sin perder el progreso. 

  