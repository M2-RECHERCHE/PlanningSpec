# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).


--
# Récapitulatif **complet** 
---

## Projet : Éditeur LaTeX avec React, CodeMirror 6 et Tailwind CSS

### **Objectif**
Créer un éditeur LaTeX stylé avec React, CodeMirror 6, et un aperçu en temps réel grâce à `react-latex-next`. Le contenu est stocké en mémoire locale (pas de backend).

---

## **Dépendances installées**
Voici la liste des dépendances nécessaires pour le projet :

```bash
npm install react react-dom @types/react @types/react-dom
npm install @codemirror/view @codemirror/state @codemirror/theme-one-dark @codemirror/commands @codemirror/language
npm install @uiw/react-codemirror
npm install react-latex-next
npm install -D tailwindcss postcss autoprefixer
npm install react-router-dom
```

---

## **Structure du projet**
```
latex-editor/
├── src/
│   ├── App.tsx
│   ├── Editor.tsx
│   ├── Home.tsx
│   ├── index.css
│   ├── main.tsx
│   └── ...
├── package.json
├── tailwind.config.js
└── ...
```

---

## **Étapes de configuration**

### 1. Initialiser le projet
```bash
npx create-react-app latex-editor --template typescript
cd latex-editor
```

### 2. Installer les dépendances
```bash
npm install @codemirror/view @codemirror/state @codemirror/theme-one-dark @codemirror/commands @codemirror/language
npm install @uiw/react-codemirror
npm install react-latex-next
npm install -D tailwindcss postcss autoprefixer
npm install react-router-dom
```

### 3. Configurer Tailwind CSS
```bash
npx tailwindcss init
```

### 4. Lancer l'application
```bash
npm start
```

---

## **Fonctionnalités implémentées**
- Éditeur LaTeX avec CodeMirror 6.
- Aperçu en temps réel avec `react-latex-next`.
- Barre latérale avec boutons fictifs.
- Routage avec React Router.
- Style avec Tailwind CSS.

---

## **Prochaines étapes possibles**
- Ajouter un bouton pour exporter le rendu en PDF.
- Sauvegarder le contenu dans le `localStorage`.
- Ajouter une gestion de projets locaux.

---

**Bon développement !** 
