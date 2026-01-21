# Quick Peek Sidebar

![Github All Releases](https://img.shields.io/github/downloads/bwya77/obsidian-quick-peek-sidebar/total.svg)

Automatically expand and collapse the left/right or both sidebars when hovering over the edge of the window.

![Demo video](/images/demo.gif) 

## Features

- Expands the left sidebar when hovering over the left edge of the window
- Expands the right sidebar when hovering over the right edge of the window
- Configurable hover trigger areas (pixel distance from edges)
- Set the expand/collapse animation speed
- Option to overlay the sidebars on top of the main content
- Set maximum width for the left and right sidebars
- Configurable delay before expanding
- Configurable delay before collapsing
- Option to sync left and right sidebars (expand/collapse both together)

### Configuration

You can customize the following settings in the plugin options:

![Plugin Settings](/images/settings.png) 

Here is the sidebar settings formatted in the requested table style:

## Sidebar Settings

### General

| Setting             | Description                                                                             | Default    |
| ------------------- | --------------------------------------------------------------------------------------- | ---------- |
| Left Sidebar Hover  | Enables the expansion and collapsing of the left sidebar on hover.                      | Enabled |
| Right Sidebar Hover | Enables the expansion and collapsing of the right sidebar on hover.                     | Enabled |
| Sync Left and Right | Expands both sidebars simultaneously when one is hovered (requires both to be enabled). | Disabled |
| Overlay Mode        | Sidebars slide over the main content instead of pushing it.                             | Disabled |
| Double Click Pin Sidebar        | Double click to keep sidebar open. Double click again to unpin it                             | Disabled | 

### Behavior

| Setting                     | Description                                                           | Default |
| --------------------------- | --------------------------------------------------------------------- | ------- |
| Left Sidebar Pixel Trigger  | Pixels from the left edge that trigger the sidebar to open on hover.  | 20      |
| Right Sidebar Pixel Trigger | Pixels from the right edge that trigger the sidebar to open on hover. | 20      |

### Timing

| Setting                         | Description                                                      | Default |
| ------------------------------- | ---------------------------------------------------------------- | ------- |
| Sidebar Collapse Delay          | Delay in ms before the sidebar collapses after the mouse leaves. | 250     |
| Sidebar Expand Delay            | Delay in ms before the sidebar expands after hovering.           | 10      |
| Expand/Collapse Animation Speed | Speed of the sidebar expand/collapse animation in ms.            | 375     |

### Appearance

| Setting                     | Description                                    | Default |
| --------------------------- | ---------------------------------------------- | ------- |
| Left Sidebar Maximum Width  | Maximum width in pixels for the left sidebar.  | 325     |
| Right Sidebar Maximum Width | Maximum width in pixels for the right sidebar. | 325     |

## Installation

1. Open Obsidian Settings
2. Navigate to Community Plugins and disable Safe Mode
3. Click Browse and search for "Quick Peek Sidebar"
4. Install the plugin
5. Enable the plugin in your Community Plugins list

### Manual Installation

1. Download the latest release from the releases page
2. Extract the files into your vault's `.obsidian/plugins/quick-peek-sidebar/` directory
3. Reload Obsidian
4. Enable the plugin in your Community Plugins list

## Development

Want to contribute or modify the plugin? Here's how to get started with the source code:

1. Create a directory for your GitHub projects:
   ```bash
   cd path/to/somewhere
   mkdir Github
   cd Github
   ```

2. Clone the repository:
   ```bash
   git clone https://github.com/bwya77/obsidian-quick-peek-sidebar.git
   ```

3. Navigate to the plugin directory:
   ```bash
   cd open-sidebar-on-hover
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start development build mode:
   ```bash
   npm run dev
   ```
   This command will keep running in the terminal and automatically rebuild the plugin whenever you make changes to the source code.

6. You'll see a `main.js` file appear in the plugin directory - this is the compiled version of your plugin.

### Testing Your Changes

To test your modifications:

1. Create a symbolic link or copy your plugin folder to your vault's `.obsidian/plugins/` directory
2. Enable the plugin in Obsidian's community plugins settings
3. Use the developer console (Ctrl+Shift+I) to check for errors and debug

### Making Contributions

1. Fork the repository
2. Create a new branch for your feature
3. Make your changes
4. Submit a pull request with a clear description of your changes

# Contributions
[clairefro](https://github.com/clairefro) 
- Added: ability to expand and collapse the right sidebar on hover instead of over the ribbon


## License

MIT License. See [LICENSE](https://github.com/bwya77/obsidian-quick-peek-sidebar/blob/main/LICENSE) for full text.
