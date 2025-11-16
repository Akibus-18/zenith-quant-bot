# Quantum Scalper Pro - Deployment Guide

## 🚀 Quick Deploy

This bot is a fully static React application that can be deployed to **GitHub Pages**, **Vercel**, or **Netlify** for **FREE**.

---

## 📋 Prerequisites

- A Deriv account with API token
- Git installed (for GitHub Pages)
- Node.js 18+ (for building locally)

---

## 🌐 Deploy to Vercel (Recommended - Easiest)

1. **Fork or Clone** this repository
2. Go to [vercel.com](https://vercel.com)
3. Click **"New Project"**
4. Import your GitHub repository
5. Vercel will auto-detect the settings
6. Click **"Deploy"**
7. Done! Your bot will be live in ~2 minutes

**Custom Domain:**
- Go to Project Settings → Domains
- Add your custom domain

---

## 📦 Deploy to Netlify

1. **Fork or Clone** this repository
2. Go to [netlify.com](https://netlify.com)
3. Click **"Add new site"** → **"Import an existing project"**
4. Connect to your GitHub repository
5. Build settings (auto-detected):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Click **"Deploy"**
7. Done! Your bot will be live

**Custom Domain:**
- Go to Site Settings → Domain Management
- Add your custom domain

---

## 🐙 Deploy to GitHub Pages

1. **Fork or Clone** this repository

2. **Update `vite.config.ts`:**
   ```typescript
   export default defineConfig(({ mode }) => ({
     base: '/your-repo-name/', // Replace with your repository name
     // ... rest of config
   }));
   ```

3. **Create `.github/workflows/deploy.yml`:**
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [ main ]

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Setup Node
           uses: actions/setup-node@v3
           with:
             node-version: 18
             
         - name: Install dependencies
           run: npm ci
           
         - name: Build
           run: npm run build
           
         - name: Deploy to GitHub Pages
           uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

4. **Enable GitHub Pages:**
   - Go to Repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` / `root`
   - Save

5. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

6. Your site will be live at `https://yourusername.github.io/your-repo-name/`

---

## 🏗️ Build Locally

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🔑 Getting Your Deriv API Token

1. Go to [app.deriv.com](https://app.deriv.com)
2. Navigate to **Settings** → **API Token**
3. Create a new token with these scopes:
   - **Read** ✅
   - **Trade** ✅
   - **Trading information** ✅
   - **Payments** ✅
4. Copy the token and paste it into the bot

⚠️ **Security Note:** Never share your API token or commit it to git.

---

## ⚙️ Bot Features

✅ **Multi-Strategy Analysis:**
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- EMA (Exponential Moving Averages)
- Bollinger Bands
- Stochastic Oscillator
- ATR (Average True Range)

✅ **Contract Types:**
- Rise/Fall
- Even/Odd
- Over/Under
- Matches/Differs

✅ **Smart Money Management:**
- Configurable stake amounts
- Martingale strategy
- Take profit / Stop loss
- Confidence-based position sizing

✅ **Real-Time Analytics:**
- Live balance updates
- Win rate tracking
- P&L monitoring
- Trade history

---

## 🎯 Usage Tips

1. **Start with demo account** to test strategies
2. **Use low stakes** initially ($0.35 - $1.00)
3. **Set confidence threshold** high (60%+) for quality signals
4. **Monitor performance** and adjust settings
5. **Never risk more than you can afford to lose**

---

## 📊 Performance Optimization

- Uses WebSocket for real-time data
- Efficient indicator calculations
- Smart cooldown system to prevent overtrading
- Adaptive confidence scoring

---

## 🛡️ Security

- All API communication via WSS (encrypted)
- Tokens never stored on servers
- Pure frontend application
- No backend data collection

---

## 🆘 Troubleshooting

**Connection Issues:**
- Verify your API token is correct
- Check your internet connection
- Ensure token has correct permissions

**No Trades Executing:**
- Check confidence threshold (try lowering it)
- Verify sufficient balance
- Check market is open
- Review minimum stake requirements

**Build Errors:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Update Node.js to version 18+
- Check console for specific errors

---

## 📄 License

MIT License - Feel free to modify and distribute

---

## ⚠️ Disclaimer

Trading involves risk. This bot is for educational and informational purposes. Always:
- Use demo accounts first
- Never invest more than you can afford to lose
- Understand the risks of automated trading
- Past performance doesn't guarantee future results

---

**Built with ❤️ using React, TypeScript, and Vite**
