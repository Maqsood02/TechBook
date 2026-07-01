const b64 = "pnka5ob16bRfZCrwHVx88DHASSkHBGMVN3KxTrkp1l";
const buf = Buffer.from(b64, 'base64');
console.log('Decoded text:', buf.toString('utf8'));
console.log('Decoded hex:', buf.toString('hex'));
