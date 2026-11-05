package com.gogreen.controlplane.transport.grpc;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;

@Component
public class GrpcServerManager {
    private static final Logger log = LoggerFactory.getLogger(GrpcServerManager.class);

    private final MeshCoordinatorGrpcService coordinatorService;
    private final int port;
    private final int maxMessageSize;
    private final boolean tlsEnabled;
    private final boolean mtlsEnabled;
    private final String certChainPath;
    private final String privateKeyPath;
    private final String trustCertPath;

    private Server server;

    public GrpcServerManager(
            MeshCoordinatorGrpcService coordinatorService,
            @Value("${mesh.coordinator.grpc.port:50051}") int port,
            @Value("${mesh.coordinator.grpc.max-message-size:8388608}") int maxMessageSize,
            @Value("${mesh.coordinator.grpc.tls.enabled:false}") boolean tlsEnabled,
            @Value("${mesh.coordinator.grpc.tls.mtls-enabled:false}") boolean mtlsEnabled,
            @Value("${mesh.coordinator.grpc.tls.cert-chain-path:}") String certChainPath,
            @Value("${mesh.coordinator.grpc.tls.private-key-path:}") String privateKeyPath,
            @Value("${mesh.coordinator.grpc.tls.trust-cert-path:}") String trustCertPath) {
        this.coordinatorService = coordinatorService;
        this.port = port;
        this.maxMessageSize = maxMessageSize;
        this.tlsEnabled = tlsEnabled;
        this.mtlsEnabled = mtlsEnabled;
        this.certChainPath = certChainPath;
        this.privateKeyPath = privateKeyPath;
        this.trustCertPath = trustCertPath;
    }

    @PostConstruct
    public void start() throws IOException {
        ServerBuilder<?> builder = ServerBuilder.forPort(port)
                .addService(coordinatorService)
                .maxInboundMessageSize(maxMessageSize);

        if (tlsEnabled && !certChainPath.isBlank() && !privateKeyPath.isBlank()) {
            File certFile = new File(certChainPath);
            File keyFile = new File(privateKeyPath);
            if (mtlsEnabled && !trustCertPath.isBlank()) {
                File trustFile = new File(trustCertPath);
                builder.useTransportSecurity(certFile, keyFile)
                        .trustManager(trustFile);
                log.info("gRPC server configured with Mutual TLS (mTLS). Trust CA: {}", trustCertPath);
            } else {
                builder.useTransportSecurity(certFile, keyFile);
                log.info("gRPC server configured with Server TLS.");
            }
        }

        this.server = builder.build().start();
        log.info("GoGreen Mesh gRPC Coordinator Server started on port {}", port);
    }

    @PreDestroy
    public void stop() {
        if (server != null) {
            log.info("Shutting down GoGreen Mesh gRPC Coordinator Server...");
            server.shutdown();
        }
    }

    public int getPort() {
        return port;
    }
}
