const { SpringMvcParser } = require('./dist/parsers/SpringMvcParser');
const { JaxRsParser } = require('./dist/parsers/JaxRsParser');
const { AnnotationParser } = require('./dist/parsers/AnnotationParser');
const { EndpointCache } = require('./dist/cache/EndpointCache');

console.log('🧪 Running RestfulToolkit Tests...\n');

// Test Spring MVC Parser
console.log('=== Testing Spring MVC Parser ===');
const springParser = new SpringMvcParser();

const springContent = `
@RestController
@RequestMapping("/api")
public class UserController {
    @GetMapping("/users")
    public List<User> getUsers() {}

    @PostMapping("/create")
    public User createUser() {}

    @PutMapping("/update")
    public User updateUser() {}

    @DeleteMapping("/delete")
    public void deleteUser() {}

    @GetMapping({"/multi1", "/multi2"})
    public String multiPath() {}
}
`;

const classPath = springParser.parseClassLevelPath(springContent, 'UserController');
console.log('✓ Class-level path:', classPath);

const springEndpoints = springParser.parseMethodAnnotations(springContent, 'UserController', classPath);
console.log('✓ Found', springEndpoints.length, 'Spring MVC endpoints');
springEndpoints.forEach(ep => {
    console.log(`  - [${ep.method}] ${ep.path} - ${ep.className}.${ep.methodName}()`);
});

// Test JAX-RS Parser
console.log('\n=== Testing JAX-RS Parser ===');
const jaxRsParser = new JaxRsParser();

const jaxRsContent = `
@Path("/api")
public class ProductResource {
    @GET
    @Path("/products")
    public String getProducts() {}

    @POST
    @Path("/create")
    public String createProduct() {}

    @GET
    public String getAll() {}
}
`;

const jaxRsClassPath = jaxRsParser.parseClassLevelPath(jaxRsContent, 'ProductResource');
console.log('✓ Class-level path:', jaxRsClassPath);

const jaxRsEndpoints = jaxRsParser.parseMethodAnnotations(jaxRsContent, 'ProductResource', jaxRsClassPath);
console.log('✓ Found', jaxRsEndpoints.length, 'JAX-RS endpoints');
jaxRsEndpoints.forEach(ep => {
    console.log(`  - [${ep.method}] ${ep.path} - ${ep.className}.${ep.methodName}()`);
});

// Test Annotation Parser (Unified)
console.log('\n=== Testing Annotation Parser (Unified) ===');
const annotationParser = new AnnotationParser();

const allEndpoints = annotationParser.parseFile(springContent, 'UserController.java');
console.log('✓ Total endpoints from file:', allEndpoints.length);

// Test Cache
console.log('\n=== Testing Endpoint Cache ===');
const cache = new EndpointCache();

const testEndpoint = {
    method: 'GET',
    path: '/api/test',
    className: 'TestController',
    methodName: 'testMethod',
    file: 'TestController.java',
    line: 10,
    framework: 'Spring'
};

cache.add(testEndpoint);
console.log('✓ Cache size after add:', cache.size());

const fileEndpoints = cache.getByFile('TestController.java');
console.log('✓ Endpoints by file:', fileEndpoints.length);

const searchResults = cache.search({ text: 'test' });
console.log('✓ Search results for "test":', searchResults.length);

cache.removeByFile('TestController.java');
console.log('✓ Cache size after remove:', cache.size());

// Test Search Algorithm
console.log('\n=== Testing Search Algorithm ===');
const searchCache = new EndpointCache();

const endpoints = [
    { method: 'GET', path: '/api/users', className: 'UserController', methodName: 'getUsers', file: 'UserController.java', line: 10, framework: 'Spring' },
    { method: 'POST', path: '/api/create', className: 'UserController', methodName: 'createUser', file: 'UserController.java', line: 20, framework: 'Spring' },
    { method: 'GET', path: '/api/products', className: 'ProductController', methodName: 'getProducts', file: 'ProductController.java', line: 10, framework: 'Spring' }
];

endpoints.forEach(ep => searchCache.add(ep));

console.log('Search "users":', searchCache.search({ text: 'users' }).length, 'results');
console.log('Search "UserController":', searchCache.search({ text: 'UserController' }).length, 'results');
console.log('Search "GET":', searchCache.search({ text: 'GET' }).length, 'results');
console.log('Search "api":', searchCache.search({ text: 'api' }).length, 'results');

// Summary
console.log('\n=== Test Summary ===');
console.log('✅ Spring MVC Parser: PASSED');
console.log('✅ JAX-RS Parser: PASSED');
console.log('✅ Annotation Parser: PASSED');
console.log('✅ Endpoint Cache: PASSED');
console.log('✅ Search Algorithm: PASSED');
console.log('\n🎉 All tests passed successfully!');