"use client";

import type { UpgradeId } from "../skill-config";
import { appHref } from "../site-path";

const SKILL_SYMBOLS: Partial<Record<UpgradeId, string>> = {
  "warrior-smash": "⚒", "warrior-shockwave": "◉", "warrior-execute": "✦", "warrior-crush": "◆", "warrior-guard": "⬡",
  "archer-rapid": "➶", "archer-pierce": "➵", "archer-ricochet": "⌁", "archer-focus": "◎", "archer-weakpoint": "⌾",
  "mage-fireball": "●", "mage-lightning": "ϟ", "mage-freeze": "❄", "mage-black-hole": "◌", "mage-mana-blast": "✧",
  "common-magnet": "⌁", "common-luck": "✤", "common-wide": "↔", "common-move-speed": "»", "common-xp": "◇", "common-combo": "∞",
  "common-ball-size": "●", "common-skill-range": "◎", "common-chain": "⌘", "common-damage": "▲", "common-magic": "✦", "common-cooldown": "◷",
};

function skillIconPath(id: UpgradeId) {
  if (!SKILL_SYMBOLS[id]) return null;
  const category = id.split("-", 1)[0];
  return appHref(`/assets/ui/skills/forged-core/${category}/${id}.webp`);
}

export function SkillIconArt({ id }: { id: UpgradeId }) {
  const src = skillIconPath(id);

  return (
    <>
      <span className="skill-icon-fallback" aria-hidden="true">{SKILL_SYMBOLS[id] ?? "•"}</span>
      {src && (
        // The fallback must survive a missing user-generated skill asset, which
        // requires observing the native image error event.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="skill-icon-art"
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      )}
    </>
  );
}
