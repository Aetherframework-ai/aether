use crate::task::{ResourceType, ServiceResource};
use std::collections::HashMap;
use std::sync::RwLock;

/// Service registration information
#[derive(Debug, Clone)]
pub struct ServiceInfo {
    pub service_name: String,
    pub group: String,
    pub languages: Vec<String>,
    pub provides: HashMap<String, ServiceResource>,
    pub endpoint: String,
    pub registered_at: chrono::DateTime<chrono::Utc>,
}

/// Service registry for cross-language support
#[derive(Debug, Default)]
pub struct ServiceRegistry {
    services: RwLock<HashMap<String, ServiceInfo>>,
}

impl ServiceRegistry {
    /// Create a new service registry
    pub fn new() -> Self {
        Self {
            services: RwLock::new(HashMap::new()),
        }
    }

    /// Register a service
    pub fn register(
        &self,
        service_name: String,
        group: String,
        languages: Vec<String>,
        provides: Vec<ServiceResource>,
        endpoint: String,
    ) {
        let mut services = self.services.write().unwrap();

        let provides_map: HashMap<String, ServiceResource> =
            provides.into_iter().map(|r| (r.name.clone(), r)).collect();

        services.insert(
            service_name.clone(),
            ServiceInfo {
                service_name,
                group,
                languages,
                provides: provides_map,
                endpoint,
                registered_at: chrono::Utc::now(),
            },
        );
    }

    /// Unregister a service
    pub fn unregister(&self, service_name: &str) -> bool {
        let mut services = self.services.write().unwrap();
        services.remove(service_name).is_some()
    }

    /// Get a service by name
    pub fn get(&self, service_name: &str) -> Option<ServiceInfo> {
        let services = self.services.read().unwrap();
        services.get(service_name).cloned()
    }

    /// Check if a service exists
    pub fn exists(&self, service_name: &str) -> bool {
        let services = self.services.read().unwrap();
        services.contains_key(service_name)
    }

    /// List all services
    pub fn list(&self) -> Vec<ServiceInfo> {
        let services = self.services.read().unwrap();
        services.values().cloned().collect()
    }

    /// Find a resource in any registered service
    pub fn find_resource(&self, resource_name: &str) -> Option<(String, ServiceResource)> {
        let services = self.services.read().unwrap();

        for (service_name, service) in services.iter() {
            if let Some(resource) = service.provides.get(resource_name) {
                return Some((service_name.clone(), resource.clone()));
            }
        }

        None
    }

    /// Find a resource in a specific service
    pub fn find_resource_in_service(
        &self,
        service_name: &str,
        resource_name: &str,
    ) -> Option<ServiceResource> {
        let services = self.services.read().unwrap();
        services
            .get(service_name)
            .and_then(|s| s.provides.get(resource_name))
            .cloned()
    }

    /// Get all services that provide a specific resource type
    pub fn get_services_by_resource_type(&self, resource_type: ResourceType) -> Vec<ServiceInfo> {
        let services = self.services.read().unwrap();
        services
            .values()
            .filter(|s| {
                s.provides
                    .values()
                    .any(|r| r.resource_type == resource_type)
            })
            .cloned()
            .collect()
    }

    /// Get service count
    pub fn len(&self) -> usize {
        let services = self.services.read().unwrap();
        services.len()
    }

    /// Check if registry is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_service() {
        let registry = ServiceRegistry::new();

        let provides = vec![
            ServiceResource {
                name: "process".to_string(),
                resource_type: ResourceType::Step,
                metadata: None,
            },
            ServiceResource {
                name: "analyze".to_string(),
                resource_type: ResourceType::Activity,
                metadata: Some(ResourceMetadata {
                    max_attempts: Some(3),
                    timeout: Some(30000),
                    input_schema: None,
                    output_schema: None,
                }),
            },
        ];

        registry.register(
            "data-proc".to_string(),
            "data-group".to_string(),
            vec!["python".to_string()],
            provides,
            "python-service:50051".to_string(),
        );

        assert!(registry.exists("data-proc"));
        assert_eq!(registry.len(), 1);

        let service = registry.get("data-proc").unwrap();
        assert_eq!(service.service_name, "data-proc");
        assert_eq!(service.group, "data-group");
        assert!(service.provides.contains_key("process"));
        assert!(service.provides.contains_key("analyze"));
    }

    #[test]
    fn test_find_resource() {
        let registry = ServiceRegistry::new();

        let provides = vec![ServiceResource {
            name: "process".to_string(),
            resource_type: ResourceType::Step,
            metadata: None,
        }];

        registry.register(
            "data-proc".to_string(),
            "data-group".to_string(),
            vec!["python".to_string()],
            provides,
            "python-service:50051".to_string(),
        );

        let result = registry.find_resource("process");
        assert!(result.is_some());
        let (service_name, resource) = result.unwrap();
        assert_eq!(service_name, "data-proc");
        assert_eq!(resource.name, "process");
        assert_eq!(resource.resource_type, ResourceType::Step);
    }

    #[test]
    fn test_find_resource_not_found() {
        let registry = ServiceRegistry::new();

        let result = registry.find_resource("nonexistent");
        assert!(result.is_none());
    }

    #[test]
    fn test_unregister_service() {
        let registry = ServiceRegistry::new();

        let provides = vec![];
        registry.register(
            "data-proc".to_string(),
            "data-group".to_string(),
            vec!["python".to_string()],
            provides,
            "python-service:50051".to_string(),
        );

        assert!(registry.exists("data-proc"));

        let removed = registry.unregister("data-proc");
        assert!(removed);
        assert!(!registry.exists("data-proc"));

        let removed_again = registry.unregister("data-proc");
        assert!(!removed_again);
    }
}
