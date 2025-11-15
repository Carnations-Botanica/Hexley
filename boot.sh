#!/bin/bash

# Specifically load an environment file for the pseudo-"bootloader"
if [ -f .env ]; then
    source .bootenv
fi

VERSION="1.0.0" # Meh, not particularly accurate, but it's the first time its been done this way
DEFAULT_KERNEL="hexleyCore-v3.0.0"
KERNEL_FILE="${KERNEL:-$DEFAULT_KERNEL}"
KERNEL_IDENTITY="${KERNEL_FILE%-*}"
KERNEL_PATH="kernels/${KERNEL_IDENTITY}/${KERNEL_FILE}.ts"

clear
echo "hexleyBoot version ${VERSION}"
echo "Starting Hexley Kernel at: ${KERNEL_PATH}"

# Execute the Kernel using Bun
bun run "$KERNEL_PATH"
