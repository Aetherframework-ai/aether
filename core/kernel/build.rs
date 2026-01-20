fn main() {
    let proto_path = std::path::Path::new("proto/aether.proto");
    tonic_build::configure()
        .out_dir("src/proto")
        .file_descriptor_set_path("src/proto/descriptor.bin")
        .compile(&[proto_path], &["proto"])
        .unwrap();
}
