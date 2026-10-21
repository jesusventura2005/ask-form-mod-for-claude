# ask-form-mod-for-claude

Un mod para [Claude Code](https://claude.com/claude-code) que dibuja las preguntas de Claude como un **formulario paso a paso**, al estilo de opencode:

- Una pregunta a la vez, con pestañas arriba y una pantalla de revisión antes de enviar.
- Puedes **retroceder y avanzar** entre preguntas.
- La opción **recomendada va primero** y siempre hay una opción para **escribir tu propia respuesta**.
- Opción única, multi-selección, texto libre y números, según lo que Claude necesite.

## Instalación

Necesitas Claude Code y Node 18 o superior. Funciona en macOS, Linux y Windows.

```bash
npx ask-form-mod-for-claude
# o con pnpm
pnpm dlx ask-form-mod-for-claude
```

Sin opciones, el instalador te pregunta lo necesario. Para no responder preguntas:

```bash
npx ask-form-mod-for-claude --enforce-forms --scope user -y
```

| Opción | Qué hace |
| --- | --- |
| `--enforce-forms` | Claude hace **todas** sus preguntas por el formulario (por defecto). |
| `--no-enforce-forms` | Instala el formulario, pero Claude puede seguir preguntando en texto. |
| `--scope user\|project\|local` | Para todas tus sesiones (por defecto), para el proyecto o solo local. |
| `--dir <ruta>` | Dónde guardar los archivos del mod (por defecto `~/.claude/ask-form`). |
| `-y`, `--yes` | No pregunta; usa los valores por defecto. |

Después, abre una sesión nueva de Claude Code o ejecuta `/reload-plugins`.

> No muevas ni borres la carpeta del mod (`~/.claude/ask-form`): Claude la lee desde ahí.

## Comandos

```bash
npx ask-form-mod-for-claude status      # ¿está instalado?
npx ask-form-mod-for-claude uninstall   # lo quita y borra su carpeta
```

Para cambiar la opción de forzar formularios más adelante: `/plugin configure ask-form@ask-form-local` dentro de Claude Code.

## Atajos de teclado en el formulario

| Tecla | Acción |
| --- | --- |
| ↑ / ↓, Tab | Mover el foco |
| Enter | Seleccionar |
| `1`-`4` | Elegir esa opción |
| `o` | Escribir tu propia respuesta |
| `b` / `n` | Pregunta anterior / siguiente |
| `s` | Enviar (en la pantalla de revisión) |
| `x`, Esc | Cancelar |

## Limitaciones

- No funciona en la app móvil de Claude (no tiene campos de texto todavía).
- «Forzar formularios» es una instrucción para Claude, no una regla del motor: una skill que pida explícitamente preguntar en texto puede ganarle.

## Licencia

MIT
