window.SPRITE_DATA = [
  {rarity:'Rare',name:'Water',files:['01_Water.png','02_Gold_Water.png','03_Gummy_Water.png','04_Galaxy_Water.png']},
  {rarity:'Rare',name:'Earth',files:['05_Earth.png','06_Gold_Earth.png','07_Gummy_Earth.png','08_Galaxy_Earth.png']},
  {rarity:'Rare',name:'Fire',files:['09_Fire.png','10_Gold_Fire.png','11_Gummy_Fire.png','12_Galaxy_Fire.png']},
  {rarity:'Rare',name:'Fishy',files:['42_Fishy.png','43_Gold_Fishy.png','44_Gummy_Fishy.png','45_Galaxy_Fishy.png']},
  {rarity:'Epic',name:'Duck',files:['13_Duck.png','14_Gold_Duck.png','15_Gummy_Duck.png','16_Galaxy_Duck.png']},
  {rarity:'Epic',name:'Ghost',files:['17_Ghost.png','18_Gold_Ghost.png','19_Gummy_Ghost.png','20_Galaxy_Ghost.png']},
  {rarity:'Epic',name:'Demon',files:['25_Demon.png','26_Gold_Demon.png','27_Gummy_Demon.png','28_Galaxy_Demon.png']},
  {rarity:'Epic',name:'King',files:['33_King.png','34_Gold_King.png','35_Gummy_King.png','36_Galaxy_King.png']},
  {rarity:'Epic',name:'Aura',files:['50_Aura.png','51_Gold_Aura.png','52_Gummy_Aura.png','53_Galaxy_Aura.png']},
  {rarity:'Epic',name:'Striker',files:['46_Striker.png','47_Gold_Striker.png','48_Gummy_Striker.png','49_Galaxy_Striker.png']},
  {rarity:'Legendary',name:'Dream',files:['21_Dream.png','22_Gold_Dream.png','23_Gummy_Dream.png','24_Galaxy_Dream.png']},
  {rarity:'Legendary',name:'Punk',files:['29_Punk.png','30_Gold_Punk.png','31_Gummy_Punk.png','32_Galaxy_Punk.png']},
  {rarity:'Legendary',name:'Boss',files:['54_Boss.png','55_Gold_Boss.png','56_Gummy_Boss.png','57_Galaxy_Boss.png']},
  {rarity:'Legendary',name:'Grim',files:['58_Grim.png','59_Gold_Grim.png','60_Gummy_Grim.png','61_Galaxy_Grim.png']},
  {rarity:'Mythic',name:'Zero Point',files:['38_Zero_Point.png','39_Gold_Zero_Point.png','40_Gummy_Zero_Point.png','41_Galaxy_Zero_Point.png']},
  {rarity:'Mythic',name:'Burnt Peanut',files:['37_Burnt_Peanut.png']}
].map((family) => ({
  ...family,
  id: family.name.toLowerCase().replace(/\s+/g,'-'),
  variants: family.files.map((file,index) => ({
    id:['base','gold','gummy','galaxy'][index],
    name:['Base','Gold','Gummy','Galaxy'][index],
    image:'assets/sprites/'+file
  }))
}));
