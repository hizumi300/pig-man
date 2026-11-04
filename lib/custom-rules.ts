export type Special = 'appraiser' | 'keeper';
export type Rules = { mode: 'standard' | 'custom'; capacity: number; guardians: number; traps: number; appraiser: boolean; keeper: boolean };
export const DEFAULT_RULES: Rules = { mode:'standard',capacity:10,guardians:2,traps:2,appraiser:false,keeper:false };
export const RECOMMENDED: Rules = { mode:'custom',capacity:6,guardians:2,traps:2,appraiser:true,keeper:true };
export const SPECIAL_NAMES = { appraiser:'豚小屋鑑定士',keeper:'古参の飼育係' };
export function validRules(value: unknown): Rules {
 if(value === undefined) return {...DEFAULT_RULES};
 if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('ルール設定が不正です');
 const r=value as Rules;
 if(r.mode==='standard')return {...DEFAULT_RULES};
 if(r.mode!=='custom' || !Number.isInteger(r.capacity)||r.capacity<3||r.capacity>10 || !Number.isInteger(r.guardians)||r.guardians<1||r.guardians>=r.capacity || !Number.isInteger(r.traps)||r.traps<1||r.traps>5 || ['appraiser','keeper'].some(k=>typeof r[k as keyof Rules]!=='boolean'))throw new Error('定員3〜10人、豚男1〜定員未満、罠1〜5で設定してください');
 checkSeats(r,r.capacity);
 return {mode:r.mode,capacity:r.capacity,guardians:r.guardians,traps:r.traps,appraiser:r.appraiser,keeper:r.keeper};
}
export function checkSeats(r:Rules,n:number){
 if(r.mode==='standard')return;
 const explorers=n-r.guardians;
 if((n<5&&(r.appraiser||r.keeper))||n>r.capacity||explorers<1||Number(r.appraiser)+Number(r.keeper)>explorers)throw new Error('調査役は5人以上用です。探検家を1人以上、特殊役職の人数分確保してください');
}
