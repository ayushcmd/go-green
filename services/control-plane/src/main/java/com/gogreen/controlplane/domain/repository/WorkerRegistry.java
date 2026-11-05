package com.gogreen.controlplane.domain.repository;

import com.gogreen.controlplane.domain.model.WorkerNode;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class WorkerRegistry {
    private final ConcurrentHashMap<String, WorkerNode> workers = new ConcurrentHashMap<>();

    public void save(WorkerNode worker) {
        if (worker != null && worker.getWorkerId() != null) {
            workers.put(worker.getWorkerId(), worker);
        }
    }

    public Optional<WorkerNode> findById(String workerId) {
        if (workerId == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(workers.get(workerId));
    }

    public Collection<WorkerNode> findAll() {
        return workers.values();
    }

    public boolean remove(String workerId) {
        return workers.remove(workerId) != null;
    }

    public int count() {
        return workers.size();
    }
}
