// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleSongRegistry {
    struct Song {
        string id;
        string title;
        string artist;
    }

    Song[] public songs;
    mapping(string => bool) public songExists;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function addSong(string calldata id, string calldata title, string calldata artist) external onlyOwner {
        require(!songExists[id], "Song exists");
        songs.push(Song(id, title, artist));
        songExists[id] = true;
    }

    function getSongCount() external view returns (uint256) {
        return songs.length;
    }

    function getSong(uint256 index) external view returns (Song memory) {
        require(index < songs.length, "Invalid index");
        return songs[index];
    }
}