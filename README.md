# Mode Reverse — ROBOT2FOU (JKLM.FUN)

Script Tampermonkey pour jouer en **mode reverse** (taper les mots à l'envers)
avec le bot ROBOT2FOU sur JKLM.FUN BombParty.

## Installation
1. Installer l'extension **Tampermonkey** (Chrome / Firefox / Edge).
2. Cliquer sur le lien d'installation :
   [reverse_tampermonkey.user.js](https://github.com/okbroblcxd/Mode-invers-ROBOT2FOU-JKLM.FUN/raw/main/reverse_tampermonkey.user.js)
3. Tampermonkey propose l'installation → **Installer**.
4. Recharger jklm.fun.

## Utilisation
- Dans une room du bot, un modérateur (ou toi si c'est ta room) tape `.mode reverse`.
- Le script affiche un **code à 4 chiffres** (en bas à gauche).
- Tape ce code dans le chat pour activer.


## Comment le bot et le script communiquent (Explication simple)

Ce script permet à votre navigateur de dialoguer en toute sécurité avec le bot **ROBOT2FOU** sur [JKLM.FUN](https://jklm.fun) sans que les joueurs n'aient besoin de connaissances techniques. Voici comment ils interagissent en coulisses :

### 1. L'Appel du bot
Quand un modérateur tape `.mode reverse`, le bot envoie dans le chat un message technique invisible pour les profanes (ex : `REVERSE_CHALLENGE`).

### 2. La Détection par le script
Le script surveille en permanence le chat. Dès qu'il voit l'appel du bot, il utilise une formule mathématique secrète (partagée avec le bot) pour générer un code à 4 chiffres. Il affiche alors ce code sur votre écran dans un petit encadré (l'overlay).

### 3. L'Activation par le joueur
En recopiant et en envoyant ce code à 4 chiffres dans le chat, le bot valide instantanément que vous possédez le script. Il officialise l'inversion en envoyant le signal `REVERSE_ACTIVE`.

### 4. La Vérification automatique des autres joueurs
Dès que la room passe en Reverse, le script de chaque joueur présent répond automatiquement en arrière-plan au bot par un code de présence (`REVERSE_READY`). Le bot sait ainsi précisément qui a installé le script et expulsera automatiquement les joueurs non équipés avant la partie.
