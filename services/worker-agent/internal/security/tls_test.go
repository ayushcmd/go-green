package security_test

import (
	"crypto/tls"
	"os"
	"testing"

	"github.com/ayushcmd/go-green/services/worker-agent/internal/security"
)

func TestGenerateDevCertificatesAndTLSConfig(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "gogreen-dev-pki-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	pki, err := security.GenerateDevCertificates(tempDir)
	if err != nil {
		t.Fatalf("GenerateDevCertificates failed: %v", err)
	}

	caCertPath := pki.CACertPath
	serverCertPath := pki.ServerCertPath
	serverKeyPath := pki.ServerKeyPath
	workerCertPath := pki.ClientCertPath
	workerKeyPath := pki.ClientKeyPath

	for _, p := range []string{caCertPath, serverCertPath, serverKeyPath, workerCertPath, workerKeyPath} {
		if _, statErr := os.Stat(p); statErr != nil {
			t.Errorf("Expected cert file to exist: %s, err: %v", p, statErr)
		}
	}

	// Test building Server TLS Config (mTLS required)
	serverTLS, err := security.BuildServerTLSConfig(caCertPath, serverCertPath, serverKeyPath)
	if err != nil {
		t.Fatalf("BuildServerTLSConfig failed: %v", err)
	}
	if serverTLS.ClientAuth != tls.RequireAndVerifyClientCert {
		t.Errorf("Expected ClientAuth=RequireAndVerifyClientCert, got %v", serverTLS.ClientAuth)
	}
	if serverTLS.MinVersion < tls.VersionTLS12 {
		t.Errorf("Expected MinVersion >= TLS 1.2, got %x", serverTLS.MinVersion)
	}

	// Test building Client TLS Config (mTLS with worker cert)
	clientTLS, err := security.BuildClientTLSConfig(caCertPath, workerCertPath, workerKeyPath, "localhost")
	if err != nil {
		t.Fatalf("BuildClientTLSConfig failed: %v", err)
	}
	if len(clientTLS.Certificates) != 1 {
		t.Errorf("Expected 1 client certificate, got %d", len(clientTLS.Certificates))
	}
	if clientTLS.ServerName != "localhost" {
		t.Errorf("Expected ServerName=localhost, got %s", clientTLS.ServerName)
	}
}
