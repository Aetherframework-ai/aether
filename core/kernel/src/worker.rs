use std::time::Duration;

pub struct Worker {
    pub id: String,
    pub workflow_types: Vec<String>,
    pub poll_interval: Duration,
    pub max_tasks_per_poll: usize,
}

impl Worker {
    pub fn new(id: String, workflow_types: Vec<String>) -> Self {
        Worker {
            id,
            workflow_types,
            poll_interval: Duration::from_millis(100),
            max_tasks_per_poll: 10,
        }
    }

    pub fn with_poll_interval(mut self, interval: Duration) -> Self {
        self.poll_interval = interval;
        self
    }

    pub fn with_max_tasks_per_poll(mut self, max: usize) -> Self {
        self.max_tasks_per_poll = max;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_worker_creation() {
        let worker = Worker::new("worker-1".to_string(), vec!["test-type".to_string()]);

        assert_eq!(worker.id, "worker-1");
        assert_eq!(worker.workflow_types, vec!["test-type"]);
        assert_eq!(worker.poll_interval, Duration::from_millis(100));
        assert_eq!(worker.max_tasks_per_poll, 10);
    }

    #[test]
    fn test_worker_builder_pattern() {
        let worker = Worker::new("worker-1".to_string(), vec![])
            .with_poll_interval(Duration::from_millis(500))
            .with_max_tasks_per_poll(5);

        assert_eq!(worker.poll_interval, Duration::from_millis(500));
        assert_eq!(worker.max_tasks_per_poll, 5);
    }
}
