package com.gogreen.mesh.v1;

import static io.grpc.MethodDescriptor.generateFullMethodName;

import io.grpc.CallOptions;
import io.grpc.Channel;
import io.grpc.MethodDescriptor;
import io.grpc.ServerServiceDefinition;
import io.grpc.stub.AbstractAsyncStub;
import io.grpc.stub.AbstractBlockingStub;
import io.grpc.stub.AbstractFutureStub;
import io.grpc.stub.AbstractStub;
import io.grpc.stub.ClientCalls;
import io.grpc.stub.ServerCalls;
import io.grpc.stub.StreamObserver;

/**
 * gRPC service stub and descriptors for gogreen.mesh.v1.MeshCoordinator.
 */
public final class MeshCoordinatorGrpc {

  private MeshCoordinatorGrpc() {}

  public static final String SERVICE_NAME = "gogreen.mesh.v1.MeshCoordinator";

  private static volatile MethodDescriptor<WorkerMessage, CoordinatorMessage> getConnectMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Connect",
      requestType = WorkerMessage.class,
      responseType = CoordinatorMessage.class,
      methodType = io.grpc.MethodDescriptor.MethodType.BIDI_STREAMING)
  public static MethodDescriptor<WorkerMessage, CoordinatorMessage> getConnectMethod() {
    MethodDescriptor<WorkerMessage, CoordinatorMessage> getConnectMethod;
    if ((getConnectMethod = MeshCoordinatorGrpc.getConnectMethod) == null) {
      synchronized (MeshCoordinatorGrpc.class) {
        if ((getConnectMethod = MeshCoordinatorGrpc.getConnectMethod) == null) {
          MeshCoordinatorGrpc.getConnectMethod = getConnectMethod =
              MethodDescriptor.<WorkerMessage, CoordinatorMessage>newBuilder()
                  .setType(io.grpc.MethodDescriptor.MethodType.BIDI_STREAMING)
                  .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Connect"))
                  .setSampledToLocalTracing(true)
                  .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                      WorkerMessage.getDefaultInstance()))
                  .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                      CoordinatorMessage.getDefaultInstance()))
                  .build();
        }
      }
    }
    return getConnectMethod;
  }

  public static MeshCoordinatorStub newStub(Channel channel) {
    return MeshCoordinatorStub.newStub(
        new AbstractStub.StubFactory<MeshCoordinatorStub>() {
          @java.lang.Override
          public MeshCoordinatorStub newStub(Channel channel, CallOptions callOptions) {
            return new MeshCoordinatorStub(channel, callOptions);
          }
        }, channel);
  }

  public static abstract class MeshCoordinatorImplBase implements io.grpc.BindableService {

    public StreamObserver<WorkerMessage> connect(StreamObserver<CoordinatorMessage> responseObserver) {
      return ServerCalls.asyncUnimplementedStreamingCall(getConnectMethod(), responseObserver);
    }

    @java.lang.Override
    public final ServerServiceDefinition bindService() {
      return ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getConnectMethod(),
            ServerCalls.asyncBidiStreamingCall(
              new ServerCalls.BidiStreamingMethod<WorkerMessage, CoordinatorMessage>() {
                @java.lang.Override
                public StreamObserver<WorkerMessage> invoke(StreamObserver<CoordinatorMessage> responseObserver) {
                  return connect(responseObserver);
                }
              }))
          .build();
    }
  }

  public static final class MeshCoordinatorStub extends AbstractAsyncStub<MeshCoordinatorStub> {
    private MeshCoordinatorStub(Channel channel, CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected MeshCoordinatorStub build(Channel channel, CallOptions callOptions) {
      return new MeshCoordinatorStub(channel, callOptions);
    }

    public StreamObserver<WorkerMessage> connect(StreamObserver<CoordinatorMessage> responseObserver) {
      return ClientCalls.asyncBidiStreamingCall(
          getChannel().newCall(getConnectMethod(), getCallOptions()), responseObserver);
    }
  }

  private static volatile io.grpc.ServiceDescriptor serviceDescriptor;

  public static io.grpc.ServiceDescriptor getServiceDescriptor() {
    io.grpc.ServiceDescriptor result = serviceDescriptor;
    if (result == null) {
      synchronized (MeshCoordinatorGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new MeshCoordinatorFileDescriptorSupplier())
              .addMethod(getConnectMethod())
              .build();
        }
      }
    }
    return result;
  }

  private static final class MeshCoordinatorFileDescriptorSupplier implements io.grpc.protobuf.ProtoFileDescriptorSupplier {
    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return Coordinator.getDescriptor();
    }
  }
}
