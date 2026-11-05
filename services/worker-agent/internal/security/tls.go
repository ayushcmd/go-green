package security

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"
)

type DevPKI struct {
	CADir          string
	CACertPath     string
	CAKeyPath      string
	ServerCertPath string
	ServerKeyPath  string
	ClientCertPath string
	ClientKeyPath  string
}

func BuildClientTLSConfig(caFile, certFile, keyFile, serverName string) (*tls.Config, error) {
	caCertPEM, err := os.ReadFile(caFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read CA certificate from %s: %w", caFile, err)
	}

	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caCertPEM) {
		return nil, fmt.Errorf("failed to parse CA certificate from %s", caFile)
	}

	tlsConfig := &tls.Config{
		RootCAs:            caPool,
		ServerName:         serverName,
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: false, // Strict verification: never disable
	}

	// Mutual TLS: if client cert and key are provided
	if certFile != "" && keyFile != "" {
		clientCert, err := tls.LoadX509KeyPair(certFile, keyFile)
		if err != nil {
			return nil, fmt.Errorf("failed to load client keypair: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{clientCert}
	}

	return tlsConfig, nil
}

func BuildServerTLSConfig(caFile, certFile, keyFile string) (*tls.Config, error) {
	serverCert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load server keypair: %w", err)
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		MinVersion:   tls.VersionTLS12,
	}

	// Mutual TLS: require client certificates signed by CA
	if caFile != "" {
		caCertPEM, err := os.ReadFile(caFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA certificate from %s: %w", caFile, err)
		}

		caPool := x509.NewCertPool()
		if !caPool.AppendCertsFromPEM(caCertPEM) {
			return nil, fmt.Errorf("failed to parse CA certificate from %s", caFile)
		}

		tlsConfig.ClientCAs = caPool
		tlsConfig.ClientAuth = tls.RequireAndVerifyClientCert
	}

	return tlsConfig, nil
}

func GenerateDevCertificates(baseDir string) (*DevPKI, error) {
	if err := os.MkdirAll(baseDir, 0700); err != nil {
		return nil, err
	}

	// 1. Generate Root CA
	caKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}

	caTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			Organization: []string{"GoGreen Systems Engineering"},
			CommonName:   "GoGreen Development Root CA",
		},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour * 365),
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
	}

	caBytes, err := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &caKey.PublicKey, caKey)
	if err != nil {
		return nil, err
	}

	caCertPath := filepath.Join(baseDir, "ca.crt")
	caKeyPath := filepath.Join(baseDir, "ca.key")
	if err := writePEM(caCertPath, "CERTIFICATE", caBytes); err != nil {
		return nil, err
	}
	if err := writePEM(caKeyPath, "RSA PRIVATE KEY", x509.MarshalPKCS1PrivateKey(caKey)); err != nil {
		return nil, err
	}

	// 2. Generate Coordinator Server Certificate
	serverKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}

	serverTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject: pkix.Name{
			Organization: []string{"GoGreen Systems Engineering"},
			CommonName:   "localhost",
		},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1"), net.IPv6loopback},
		DNSNames:     []string{"localhost", "coordinator.mesh.local"},
		NotBefore:    time.Now().Add(-1 * time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour * 30),
		SubjectKeyId: []byte{1, 2, 3, 4, 6},
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
	}

	serverBytes, err := x509.CreateCertificate(rand.Reader, serverTemplate, caTemplate, &serverKey.PublicKey, caKey)
	if err != nil {
		return nil, err
	}

	serverCertPath := filepath.Join(baseDir, "server.crt")
	serverKeyPath := filepath.Join(baseDir, "server.key")
	if err := writePEM(serverCertPath, "CERTIFICATE", serverBytes); err != nil {
		return nil, err
	}
	if err := writePEM(serverKeyPath, "RSA PRIVATE KEY", x509.MarshalPKCS1PrivateKey(serverKey)); err != nil {
		return nil, err
	}

	// 3. Generate Worker Client Certificate (mTLS)
	clientKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}

	clientTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(3),
		Subject: pkix.Name{
			Organization: []string{"GoGreen Systems Engineering"},
			CommonName:   "gogreen-worker-node",
		},
		NotBefore:    time.Now().Add(-1 * time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour * 30),
		SubjectKeyId: []byte{1, 2, 3, 4, 7},
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}

	clientBytes, err := x509.CreateCertificate(rand.Reader, clientTemplate, caTemplate, &clientKey.PublicKey, caKey)
	if err != nil {
		return nil, err
	}

	clientCertPath := filepath.Join(baseDir, "client.crt")
	clientKeyPath := filepath.Join(baseDir, "client.key")
	if err := writePEM(clientCertPath, "CERTIFICATE", clientBytes); err != nil {
		return nil, err
	}
	if err := writePEM(clientKeyPath, "RSA PRIVATE KEY", x509.MarshalPKCS1PrivateKey(clientKey)); err != nil {
		return nil, err
	}

	return &DevPKI{
		CADir:          baseDir,
		CACertPath:     caCertPath,
		CAKeyPath:      caKeyPath,
		ServerCertPath: serverCertPath,
		ServerKeyPath:  serverKeyPath,
		ClientCertPath: clientCertPath,
		ClientKeyPath:  clientKeyPath,
	}, nil
}

func writePEM(filePath, blockType string, data []byte) error {
	f, err := os.OpenFile(filePath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()

	return pem.Encode(f, &pem.Block{
		Type:  blockType,
		Bytes: data,
	})
}
