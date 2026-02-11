const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CA_KEY_PATH = path.join(__dirname, 'root-ca.key');
const CA_CERT_PATH = path.join(__dirname, 'root-ca.crt');

// Initialize or Load Root CA
let caKey, caCert;

function initCA() {
    if (fs.existsSync(CA_KEY_PATH) && fs.existsSync(CA_CERT_PATH)) {
        console.log('Loading existing Root CA...');
        const keyPem = fs.readFileSync(CA_KEY_PATH, 'utf8');
        const certPem = fs.readFileSync(CA_CERT_PATH, 'utf8');
        caKey = forge.pki.privateKeyFromPem(keyPem);
        caCert = forge.pki.certificateFromPem(certPem);
    } else {
        console.log('Generating new Root CA...');
        generateRootCA();
    }
}

function generateRootCA() {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    caKey = keys.privateKey;
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [{
        name: 'commonName',
        value: 'CyberProxy Root CA'
    }, {
        name: 'countryName',
        value: 'US'
    }, {
        shortName: 'ST',
        value: 'State'
    }, {
        name: 'localityName',
        value: 'City'
    }, {
        name: 'organizationName',
        value: 'CyberProxy'
    }, {
        shortName: 'OU',
        value: 'Proxy'
    }];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([{
        name: 'basicConstraints',
        cA: true
    }]);

    // Self-sign
    cert.sign(caKey, forge.md.sha256.create());
    caCert = cert;

    // Save
    fs.writeFileSync(CA_KEY_PATH, forge.pki.privateKeyToPem(caKey));
    fs.writeFileSync(CA_CERT_PATH, forge.pki.certificateToPem(caCert));
    console.log('Root CA generated and saved.');
}

function generateServerCert(hostname) {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = Math.floor(Math.random() * 100000).toString(); // simple random serial
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [{
        name: 'commonName',
        value: hostname
    }, {
        name: 'organizationName',
        value: 'CyberProxy Interception'
    }];

    cert.setSubject(attrs);
    // Set Issuer to our Root CA
    cert.setIssuer(caCert.subject.attributes);

    cert.setExtensions([{
        name: 'basicConstraints',
        cA: false
    }, {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
    }, {
        name: 'subjectAltName',
        altNames: [{
            type: 2, // DNS
            value: hostname
        }]
    }]);

    // Sign with CA Private Key
    cert.sign(caKey, forge.md.sha256.create());

    return {
        key: forge.pki.privateKeyToPem(keys.privateKey),
        cert: forge.pki.certificateToPem(cert)
    };
}

function getRootCertPath() {
    return CA_CERT_PATH;
}

module.exports = {
    initCA,
    generateServerCert,
    getRootCertPath
};
