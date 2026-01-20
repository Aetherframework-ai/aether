fn main() {
    tonic_build::configure()
        .out_dir("../core/kernel/src/proto")
        .compile(&["aether.proto"], &["."])
        .unwrap();
}
