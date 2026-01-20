fn main() {
    let proto_path = std::path::Path::new("proto/aether.proto");
    tonic_build::configure()
        .out_dir("src/proto")
        .compile(&[proto_path], &["proto"])
        .unwrap();
}
