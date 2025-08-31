#!/bin/bash

# Define the source and destination paths
src_file="HexleyCarnations.service"
dest_dir="/lib/systemd/system/"

# Check if the source file exists in the current directory
if [ -e "$src_file" ]; then
    # Check if the destination file already exists
    if [ -e "${dest_dir}${src_file}" ]; then
        echo "HexleyCarnations.service is already installed."
    else
        # Move the file to the destination directory
        cp "$src_file" "$dest_dir"

        # Check the exit status of the cp command
        if [ $? -eq 0 ]; then
            echo "Installed"
        else
            echo "Failed to install"
        fi
    fi
else
    echo "Source file '$src_file' not found in the current directory."
fi