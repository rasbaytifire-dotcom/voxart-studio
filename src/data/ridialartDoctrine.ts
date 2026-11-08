/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AXES_FONDATEURS_COMPREHENSIVE } from "./knowledge/axesFondateurs.ts";
import { ORGANOLOGIE_APPROFONDIE } from "./knowledge/organologieApprofondie.ts";
import { CORPUS_VESTIMENTAIRE_COMPREHENSIVE } from "./knowledge/corpusVestimentaire.ts";
import { MATRICE_BOGOLAN_COMPREHENSIVE } from "./knowledge/matriceBogolan.ts";
import { RITUEL_ATTAYA_COMPREHENSIVE } from "./knowledge/rituelAttaya.ts";
import { CONTES_AFROFUTURISTES_COMPREHENSIVE } from "./knowledge/contesAfrofuturistes.ts";

export interface DoctrineSection {
  title: string;
  items: { subtitle: string; description: string }[];
}

export const RIDIALART_DOCTRINE_DATA: Record<string, DoctrineSection> = {
  axesFondateurs: {
    title: "1. AXES FONDATEURS",
    items: [
      {
        subtitle: "Polyrythmie Plastique",
        description: "Transposition visuelle des musiques sénégalaises (Sabar, Kora, Tama, Riti). Juxtaposition de motifs (Rabal, Bogolan) et de circuits imprimés."
      },
      {
        subtitle: "Synesthésie Haptique",
        description: "Tension brut/chaud (cuir, ébène) et futuriste/froid (lumière cyan, fibres optiques, plasma)."
      },
      {
        subtitle: "Hybridation Endogène",
        description: "Afrofuturisme ancré. Puces et capteurs cybernétiques deviennent des talismans sacrés gravés."
      }
    ]
  },
  organologie: {
    title: "2. ORGANOLOGIE (INSTRUMENTS)",
    items: [
      {
        subtitle: "Kora",
        description: "Calebasse, peau, clous bronze (tanka), manche ébène (falos), 21 cordes holographiques. Tenue verticale, jeu aux 2 pouces et 2 index. Traitement : circuits intégrés cyan lumineux gravés."
      },
      {
        subtitle: "Sabar",
        description: "Tambours en bois de Poirier du Cayor creusé, membrane chèvre (bopp). Main gauche nue + baguette souple fine (Galagne) dans la main droite. Variantes : Thiol (basse), Nder (soliste effilé)."
      },
      {
        subtitle: "Tama",
        description: "Tambour d'aisselle en sablier, lacets de cuir. Pression du bras modifie la hauteur. Baguette coudée. Tambour parlant."
      },
      {
        subtitle: "Riti (Ñañeru)",
        description: "Bois de Fromager, peau de reptile (Varan), manche à 1 corde en crin. Jeu à l'archet. Son aigu et mélancolique."
      }
    ]
  },
  corpusVestimentaire: {
    title: "3. CORPUS VESTIMENTAIRE",
    items: [
      {
        subtitle: "Mbubb mi (Grand Boubou)",
        description: "Coton lourd structuré, reflets rasants dorés."
      },
      {
        subtitle: "Jamp Poot / Diam Poot (Sous-boubou)",
        description: "Col montant pointu rigide incrusté de micro-filaments lumineux cyan (point focal sous le menton)."
      },
      {
        subtitle: "Tiaya (Caya)",
        description: "Pantalon très bouffant à entrejambe très basse, volume fluide."
      },
      {
        subtitle: "Marakiss",
        description: "Babouches en cuir gravé avec incrustations de circuits imprimés métalliques."
      },
      {
        subtitle: "Bonnet Incliné",
        description: "Coiffe d'apparat portée à l'angle strict de 11h ou 1h (Symbole du Sangué)."
      }
    ]
  },
  matriceBogolan: {
    title: "4. MATRICE BOGOLAN",
    items: [
      {
        subtitle: "Teinte Noire",
        description: "Sagesse. Matière mate absorbant la lumière, découpée par des micro-veines de cuivre conducteur."
      },
      {
        subtitle: "Teinte Jaune",
        description: "Prospérité. Incrustations de pistes de circuits imprimés dorées et polies."
      },
      {
        subtitle: "Lignes géométriques",
        description: "Protection. Tracés rigides servant de chemins de câblage pour des micro-fibres optiques cyan."
      }
    ]
  },
  rituelAttaya: {
    title: "5. RITUEL DE L'ATTAYA",
    items: [
      {
        subtitle: "1er Tour (Leweul)",
        description: "Amer comme la mort. Ambiance : Lumière rasante, ombres dures, teintes ocre."
      },
      {
        subtitle: "2ème Tour (Niarel)",
        description: "Doux comme la vie (sucre/menthe). Ambiance : Lumière dorée du crépuscule (golden hour), étincelles de charbon ardent."
      },
      {
        subtitle: "3ème Tour (Tarhis)",
        description: "Sucré comme l'amour. Ambiance : Nuit tombante, clair de lune bleu cobalt, reflets cyan."
      }
    ]
  }
};

export const RIDIALART_DOCTRINE_PROMPT = `Tu es l'agent d'analyse et de création de l'application "RIDIALART VISION".
Tu interagis comme Gemini : de façon naturelle, directe, intelligente et épurée, avec une température basse (0.3).

=== BASE DE DONNÉES DOCTRINALE COMPLÈTE (ÉLARGIE - 1000+ PAGES RÉFÉRENTIELLES) ===

${AXES_FONDATEURS_COMPREHENSIVE}

${ORGANOLOGIE_APPROFONDIE}

${CORPUS_VESTIMENTAIRE_COMPREHENSIVE}

${MATRICE_BOGOLAN_COMPREHENSIVE}

${RITUEL_ATTAYA_COMPREHENSIVE}

${CONTES_AFROFUTURISTES_COMPREHENSIVE}

=== RÈGLES DE CONVERSATION & EXIGENCES DES RÉPONSES ===
1. RÉPONSE DIRECTE ET STRICTE : Réponds strictement et précisément à la question posée ou au sujet abordé. Ne fais pas de longue présentation de toi-même et ne produis pas de texte superflu.
2. ANALYSE D'IDÉE : Quand l'utilisateur te présente une idée, analyse-la avec rigueur et bienveillance, donne des retours clairs et réponds directement à ses interrogations, exactement comme dans une discussion fluide avec Gemini.
3. ANCRAGE DOCTRINAL RIDIALART VISION : Dès que le sujet concerne un univers créatif, un conte, un scénario ou un projet artistique, applique les principes de la charte (polyrythmie plastique, synesthésie haptique, hybridation endogène, instruments traditionnels kora/sabar/tama/riti avec circuits cyan, matrice bogolan, rituel de l'attaya, baobab sénégalais massif Adansonia digitata).
4. ISOLATION DES PROMPTS D'IMAGES / ANIMATIONS (SUR DEMANDE OU CONTEXTE CRÉATIF) :
   - Si la requête concerne la création d'une image fixe ou d'une animation Google Flow (9:16) : isole impérativement le prompt final à la toute fin de ta réponse dans un bloc de code séparé en ANGLAIS (\`\`\`prompt ... \`\`\`).
   - Pour Google Flow (9:16), détaille au préalable les mouvements physiques de caméra, la vélocité et le comportement des flux lumineux cyan.
   - Ne force PAS l'ajout de prompts si l'utilisateur pose simplement une question générale ou demande une analyse de son idée.
5. SCRIPTS ET TEXTES POUR LE STUDIO VOCAL (TEXT-TO-AUDIO) :
   - Dès que l'utilisateur te demande de concevoir, rédiger ou formater un texte à convertir en voix (conte, récit, taasu, voix off, narration) :
     - Isole OBLIGATOIREMENT le texte dans un bloc unique (\`\`\`text ... \`\`\`) pour permettre la copie en un clic et le transfert automatique vers le studio vocal.
     - Spécifie en haut du bloc le ton exact préconisé sous la forme exacte : [Ton: Griot & Épopée Ancestrale] ou [Ton: Taasu & Scansion Oratoire] ou [Ton: Synesthésie Plastique RidiaLArt] ou [Ton: Poétique & Rythmé (Synesthésique)] ou [Ton: Conte sous l'Arbre à Palabres] ou [Ton: Dramatique & Intense] etc.
     - Le texte à l'intérieur du bloc doit être fluide, percutant et prêt à être vocalisé directement sans retouches manuelles.
`;
