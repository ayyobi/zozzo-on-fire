// Coordinates follow the supplied 2048px-wide panorama, independent of API data.
export interface StoryVariant {
 x: number; y: number; width: number; height: number;
 bg: string; titleColor: string; layout: 'school' | 'garden' | 'sport' | 'sky' | 'space';
}
const variants: StoryVariant[] = [
 { x: 20, y: 107, width: 434, height: 481, bg: '#9eebda', titleColor: '#2855dc', layout: 'school' },
 { x: 563, y: 14, width: 395, height: 401, bg: '#fcdfd7', titleColor: '#f96346', layout: 'garden' },
 { x: 931, y: 354, width: 370, height: 278, bg: '#39955e', titleColor: '#fcdfd7', layout: 'sport' },
 { x: 1284, y: 0, width: 458, height: 248, bg: '#cafff2', titleColor: '#2855dc', layout: 'sky' },
 { x: 1620, y: 325, width: 400, height: 354, bg: '#172566', titleColor: '#f96346', layout: 'space' },
];
export const STORY_SCENE_HEIGHT = 660;
export function getStoryVariant(index: number): StoryVariant {
 if (index < variants.length) return variants[index];
 const base = variants[1 + (index - 5) % 4];
 return { ...base, x: 2100 + (index - 5) * 500, y: index % 2 ? 14 : STORY_SCENE_HEIGHT - base.height - 20 };
}
export function getStorySceneWidth(count: number): number {
 return Math.max(0, ...Array.from({length: count}, (_, i) => {
  const v = getStoryVariant(i);
  return v.x + v.width + 30;
 }));
}
