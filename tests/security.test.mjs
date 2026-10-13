import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,ids,credentials,checkOrigin,integer} from '../lib/security.mjs';
test('passwords are salted and placeholder seed hashes cannot authenticate',()=>{
 const a=hashPassword('a sufficiently long password'),b=hashPassword('a sufficiently long password');
 assert.notEqual(a,b);assert.ok(verifyPassword('a sufficiently long password',a));
 assert.equal(verifyPassword('wrong',a),false);assert.equal(verifyPassword('wrong','hashed_placeholder'),false);
});
test('validation rejects malformed IDs, unsafe origins, and weak signup passwords',()=>{
 assert.deepEqual(ids([1,1,2]),[1,2]);
 assert.throws(()=>ids(['1); DROP TABLE users;']));assert.throws(()=>integer(0,'Stars',1,5));
 assert.throws(()=>credentials({email:'bad',password:'abc'},true));
 assert.throws(()=>credentials({email:'chef@example.com',password:'short'},true));
 assert.throws(()=>checkOrigin(new Request('http://localhost:3000/api/pantry',{headers:{origin:'https://untrusted.example'}})));
});
