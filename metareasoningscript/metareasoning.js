export function applySubclassDeliveryReasoning(data, hierarchyMap) {
  
  function getSuperclasses(className, visited = new Set()) {
    if (visited.has(className)) return new Set();
    
    visited.add(className);
    
    const superclasses = new Set();
    const classInfo = hierarchyMap.get(className);
    
    if (!classInfo || !classInfo.parentClass) return superclasses;
    
    for (const parentClass of classInfo.parentClass) {
      superclasses.add(parentClass);
      
      const parentSuperclasses = getSuperclasses(parentClass, visited);
      for (const ancestor of parentSuperclasses) {
        superclasses.add(ancestor);
      }
    }
    
    return superclasses;
  }
  
  const classToSubclasses = new Map();
  hierarchyMap.forEach((info, className) => {
    if (info.parentClass) {
      for (const parent of info.parentClass) {
        if (!classToSubclasses.has(parent)) {
          classToSubclasses.set(parent, new Set());
        }
        classToSubclasses.get(parent).add(className);
      }
    }
  });
  
  const enhancedData = JSON.parse(JSON.stringify(data));
  
  enhancedData.forEach(entity => {
    if (!entity['beo:deliversTo']) return;
    
    const deliveries = Array.isArray(entity['beo:deliversTo']) 
      ? entity['beo:deliversTo'] 
      : [entity['beo:deliversTo']];
    
    deliveries.forEach(delivery => {
      delivery.inferred = false;
    });
    
    const inferredDeliveries = new Set();
    
    deliveries.forEach(delivery => {
      const targetClass = delivery['@id'];
      
      const superclasses = getSuperclasses(targetClass);
      
      for (const superclass of superclasses) {
        inferredDeliveries.add(superclass);
      }
    });
    
    if (inferredDeliveries.size > 0) {
      const updatedDeliveries = [...deliveries];
      
      for (const superclass of inferredDeliveries) {
        const alreadyExists = updatedDeliveries.some(d => d['@id'] === superclass);
        if (!alreadyExists) {
          updatedDeliveries.push({ '@id': superclass, inferred: true });
        }
      }
      
      entity['beo:deliversTo'] = updatedDeliveries;
    }
  });
  
  const entityMap = new Map();
  enhancedData.forEach(entity => {
    if (entity['@id']) {
      entityMap.set(entity['@id'], entity);
    }
  });
  
  enhancedData.forEach(entity => {
    if (!entity['@id'] || !entity['beo:deliversTo']) return;
    
    const entityClass = entity['@id'];
    const superclasses = getSuperclasses(entityClass);
    
    if (superclasses.size === 0) return;
    
    const deliveries = Array.isArray(entity['beo:deliversTo']) 
      ? entity['beo:deliversTo'] 
      : [entity['beo:deliversTo']];
    
    for (const superclass of superclasses) {
      const superclassEntity = entityMap.get(superclass);
      if (!superclassEntity) continue;
      
      let superDeliveries = superclassEntity['beo:deliversTo'] || [];
      superDeliveries = Array.isArray(superDeliveries) ? superDeliveries : [superDeliveries];
      
      const newDeliveries = [];
      
      deliveries.forEach(delivery => {
        const targetId = delivery['@id'];
        const alreadyExists = superDeliveries.some(d => d['@id'] === targetId);
        
        if (!alreadyExists) {
          newDeliveries.push({ '@id': targetId, inferred: true });
        }
      });
      
      if (newDeliveries.length > 0) {
        superclassEntity['beo:deliversTo'] = [...superDeliveries, ...newDeliveries];
      }
    }
  });
  
  return enhancedData;
}

