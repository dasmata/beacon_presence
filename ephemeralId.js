const crypto = require('crypto');

const generateEid = function(identityKey, rotationPeriod){
    let integer = parseInt((new Date()).getTime() / 1000),
        char1,
        char2,
        char3,
        char4;
    const secret = Buffer.from(identityKey, 'hex',)
        cipher = crypto.createCipheriv("aes-128-ecb", secret, '');
    const rotationFloat = new Float64Array(1);
    const bytesArr = bytes = new Uint8Array(rotationFloat.buffer);
    rotationFloat[0] = rotationPeriod;
    const exponent = ((bytesArr[7] & 0x7f) << 4 | bytesArr[6] >> 4) - 0x3ff
    cipher.setAutoPadding(false);



    char1 = Buffer.from([Math.floor(integer / (2 ** 24)) % 256])
    char2 = Buffer.from([Math.floor(integer / (2 ** 16)) % 256]);

    const tmp = Buffer.concat([char1, char2], 2);
    const tmp2 = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0]);
    const tmpKey = Buffer.concat([tmp2, tmp], 16);

    const tmpSecret = cipher.update(tmpKey);

    const cipher2 = crypto.createCipheriv('aes-128-ecb', tmpSecret, '');


    integer = (Math.floor(integer / 2 ** exponent)) * (2 ** exponent)
    char1 = Buffer.from([Math.floor(integer / (2 ** 24)) % 256])
    char2 = Buffer.from([Math.floor(integer / (2 ** 16)) % 256]);
    char3 = Buffer.from([Math.floor(integer / (2 ** 8)) % 256])
    char4 = Buffer.from([Math.floor(integer / (2 ** 0)) % 256]);


    const tmp3 = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, exponent]);
    const tmp4 = Buffer.concat([char1, char2, char3, char4], 4)

    
    const final = cipher2.update(Buffer.concat([tmp3, tmp4], 16));
    return final.slice(0, 8).toString('hex');
}

module.exports = {
    generateEid
}
