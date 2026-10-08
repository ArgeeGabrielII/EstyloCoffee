import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
const p=new PrismaClient();
try {
 const password=process.env.ADMIN_PASSWORD;
 if(!password || password.length<12) throw Error('ADMIN_PASSWORD must have at least 12 characters');
 for(const name of ["AMERICANO", "CAFE LATTE", "CAPPUCCINO", "CARAMEL LATTE", "SPANISH LATTE", "WHITE CHOCO MOCHA", "DARK CHOCO MOCHA", "CARAMEL MACCHIATO", "VANILLA LATTE", "HAZELNUT LATTE", "SEA SALT LATTE"]) await p.product.upsert({where:{name},update:{},create:{name}});
 await p.user.upsert({where:{username:process.env.ADMIN_USERNAME||'admin'},update:{},create:{username:process.env.ADMIN_USERNAME||'admin',displayName:'Administrator',role:'ADMIN',passwordHash:await argon2.hash(password)}});
 console.log('Menu and initial admin seeded; existing records unchanged.');
} finally {await p.$disconnect()}
