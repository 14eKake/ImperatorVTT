# Imperator VTT System

This repository contains a simple game system for **Foundry VTT** inspired by Atropos' simple system template. It provides actor and item sheets along with basic dice rolling macros to run games of *Imperator*.

## Installation

1. Clone or download this repository into your Foundry `Data/systems` directory.
2. Install the development dependencies:
   ```bash
   npm install
   ```
3. Compile the LESS stylesheets into CSS:
   ```bash
   npm run css
   ```
   Use `npm run watch` while developing to automatically recompile on changes.

After these steps start Foundry VTT and select **Imperator VTT** as the game system when creating a world.

## Development

- The `gulp` build script compiles files from `styles/`.
- To package the system for distribution, create a zip archive of the repository contents and upload it to your preferred hosting. Update `system.json` with the appropriate `manifest` and `download` URLs so Foundry can install it automatically.

## License

This project is released under the [MIT License](LICENSE.txt).
