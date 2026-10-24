{
  pkgs ? import <nixpkgs> { },
}:
pkgs.mkShell {
  packages = with pkgs; [
    nodejs
    pnpm_11
    sqitchPg
    postgresql
  ];
}
