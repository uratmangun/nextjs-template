# AI IDE Template

A minimal template for AI-powered IDE projects with pre-configured settings for popular AI coding assistants.

[Deploy to Cloudflare Pages with Wrangler CLI](https://developers.cloudflare.com/pages/framework-guides/deploy-a-static-html-site/)

## 🚀 Quick Start

### Prerequisites

Make sure you have the [GitHub CLI](https://cli.github.com/) installed:

```bash
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# Linux (Debian/Ubuntu)
sudo apt install gh

# Authenticate with GitHub
gh auth login
```

### Clone this Template

Use the GitHub CLI to create a new repository from this template:

#### Create a Private Repository (Recommended)

```bash
gh repo create my-new-repo --template uratmangun/ai-ide-template --private --clone
```

#### Create a Public Repository

```bash
gh repo create my-new-repo --template uratmangun/ai-ide-template --public --clone
```

### Command Options

| Flag | Description |
|------|-------------|
| `--template` | Specify the template repository to use |
| `--private` | Create a private repository |
| `--public` | Create a public repository |
| `--clone` | Clone the new repository to your local machine |

### Additional Options

```bash
# Create without cloning (useful for remote-only setup)
gh repo create my-new-repo --template uratmangun/ai-ide-template --private

# Clone to a specific directory
gh repo create my-new-repo --template uratmangun/ai-ide-template --private --clone
cd my-new-repo
```

## 📁 What's Included

This template comes pre-configured with:

- **`.agents/skills`** - Agent skills configurations
- **`.cursor/`** - Cursor IDE settings
- **`index.html`** - Template landing page

## 🔧 After Cloning

1. **Navigate to your new project:**
   ```bash
   cd my-new-repo
   ```

2. **Customize the template:**
   - Update `index.html` with your project details
   - Modify AI assistant configurations as needed

3. **Deploy to Cloudflare Pages with Wrangler CLI (optional):**
   ```bash
   # Install Wrangler CLI
   bun add -g wrangler

   # Authenticate with Cloudflare
   wrangler login

   # Create a Pages project (one-time setup)
   wrangler pages project create my-new-repo

   # Deploy the current directory
   wrangler pages deploy . --project-name my-new-repo
   ```

## 🌐 Live Demo

Visit the template landing page: [https://ai-ide-template.pages.dev](https://ai-ide-template.pages.dev)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ for the AI-assisted development community
