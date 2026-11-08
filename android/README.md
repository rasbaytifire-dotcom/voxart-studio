# 📱 VoxArt Studio - Application Native Android (APK)

Ce dossier contient l'ensemble du projet Android natif permettant de packager **VoxArt Studio** sous forme d'un fichier **APK Android autonome et installable** (`VoxArt-Studio.apk`).

---

## 🎯 Pourquoi cette solution résout le problème « Impossible d'installer cette appli »

Lorsque vous tentez d'installer la PWA via le menu Google Chrome sur Android, Chrome tente de contacter les serveurs de « WebAPK Minting » de Google. Or, l'URL de prévisualisation AI Studio (`ais-pre-...run.app`) redirige les robots automatisés sans cookies de session (`302 redirect`), ce qui bloque le minting automatique de Google Chrome.

**La solution native WebView :**
- ✅ Fonctionne comme une **vraie application Android native installable**.
- ✅ Active les permissions matérielles pour le **Microphone**, **WebRTC** et l'**Agent Vocal Live Gemini**.
- ✅ Active le sélecteur de fichiers Android (`FileChooser`) pour importer vidéos et musiques de fond.
- ✅ Conserve le cache local, les réglages IndexedDB et les presets audio.
- ✅ Fonctionne en plein écran immersif sans barre d'adresse de navigateur.

---

## 🚀 Méthode 1 : Téléchargement automatique via GitHub Actions (Recommandé)

Le dépôt GitHub `https://github.com/rasbaytifire-dotcom/voxart-studio.git` intègre un workflow CI/CD automatique (`.github/workflows/build-apk.yml`).

1. Rendez-vous sur votre dépôt GitHub : **`https://github.com/rasbaytifire-dotcom/voxart-studio`**
2. Cliquez sur l'onglet **Actions** en haut.
3. Sélectionnez le workflow **« Build VoxArt Studio APK »**.
4. Cliquez sur **« Run workflow »** (ou poussez un commit sur la branche principale).
5. En moins de 3 minutes, la compilation se termine avec un badge vert ✅.
6. Cliquez sur l'exécution terminée, descendez dans la section **Artifacts** et téléchargez **`VoxArt-Studio-APK`** (ou rendez-vous dans les **Releases** pour télécharger `VoxArt-Studio.apk`).
7. Transférez ou ouvrez le fichier sur votre smartphone Android et appuyez sur **Installer**.

---

## 📲 Méthode 2 : Génération instantanée sur votre smartphone avec Hermit

Si vous souhaitez une application APK installée immédiatement sur votre écran d'accueil sans passer par GitHub Actions :

1. Installez l'application gratuite **Hermit: Lite Apps Browser** depuis le Google Play Store.
2. Ouvrez Hermit et touchez le bouton **Créer une Lite App (+)**.
3. Entrez l'URL : `https://ais-pre-i3grmt5zrq7cmfq7wtekw6-386454114574.europe-west2.run.app`
4. Nommez l'application **VoxArt Studio** et validez.
5. Hermit crée instantanément un conteneur APK autonome sur votre écran d'accueil, avec support complet du micro, de l'audio et des notifications !

---

## 💻 Méthode 3 : Compilation locale avec Android Studio

1. Ouvrez **Android Studio**.
2. Choisissez **Open an Existing Project** et sélectionnez le dossier `android/`.
3. Attendez la synchronisation Gradle.
4. Allez dans le menu **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. Le fichier APK sera généré dans `android/app/build/outputs/apk/debug/app-debug.apk`.
