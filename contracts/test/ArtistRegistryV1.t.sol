// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./BaseTest.sol";
import "../src/core/ArtistRegistryV1.sol";

contract ArtistRegistryV1Test is BaseTest {

    ArtistRegistryV1 public registry;

    event ArtistRegistered(
        uint32 indexed geniusArtistId,
        address indexed pkpAddress,
        string lensHandle,
        address lensAccountAddress
    );

    function setUp() public override {
        super.setUp();

        vm.startPrank(owner);
        registry = new ArtistRegistryV1();
        registry.setAuthorized(authorized, true);
        vm.stopPrank();
    }

    // ============ Constructor Tests ============

    function test_Constructor() public {
        assertEq(registry.owner(), owner);
        assertTrue(registry.isAuthorized(owner));
    }

    // ============ Registration Tests ============

    function test_RegisterArtist() public {
        vm.startPrank(authorized);

        vm.expectEmit(true, true, false, true);
        emit ArtistRegistered(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        registry.registerArtist(
            GENIUS_ARTIST_1,
            pkp1,
            LENS_HANDLE_1,
            lensAccount1
        );

        vm.stopPrank();

        // Verify artist registered
        IArtistRegistry.Artist memory artist = registry.getArtist(GENIUS_ARTIST_1);

        assertEq(artist.geniusArtistId, GENIUS_ARTIST_1);
        assertEq(artist.pkpAddress, pkp1);
        assertEq(artist.lensHandle, LENS_HANDLE_1);
        assertEq(artist.lensAccountAddress, lensAccount1);
        assertFalse(artist.verified); // Initially not verified
        assertGt(artist.createdAt, 0);
    }

    function test_RegisterMultipleArtists() public {
        vm.startPrank(authorized);

        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);
        registry.registerArtist(GENIUS_ARTIST_2, pkp2, LENS_HANDLE_2, lensAccount2);

        vm.stopPrank();

        assertEq(registry.totalArtists(), 2);
    }

    function test_RevertWhen_ArtistAlreadyExists() public {
        vm.startPrank(authorized);

        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IArtistRegistry.ArtistAlreadyExists.selector,
                GENIUS_ARTIST_1
            )
        );
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        vm.stopPrank();
    }

    function test_RevertWhen_InvalidGeniusId() public {
        vm.startPrank(authorized);

        vm.expectRevert(IArtistRegistry.InvalidGeniusId.selector);
        registry.registerArtist(0, pkp1, LENS_HANDLE_1, lensAccount1);

        vm.stopPrank();
    }

    function test_RevertWhen_InvalidPKPAddress() public {
        vm.startPrank(authorized);

        vm.expectRevert(IArtistRegistry.InvalidPKPAddress.selector);
        registry.registerArtist(GENIUS_ARTIST_1, address(0), LENS_HANDLE_1, lensAccount1);

        vm.stopPrank();
    }

    function test_RevertWhen_InvalidLensAccount() public {
        vm.startPrank(authorized);

        vm.expectRevert(IArtistRegistry.InvalidLensAccountAddress.selector);
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, address(0));

        vm.stopPrank();
    }

    function test_RevertWhen_PKPAlreadyUsed() public {
        vm.startPrank(authorized);

        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IArtistRegistry.PKPAlreadyRegistered.selector,
                pkp1
            )
        );
        registry.registerArtist(GENIUS_ARTIST_2, pkp1, LENS_HANDLE_2, lensAccount2);

        vm.stopPrank();
    }

    function test_RevertWhen_LensHandleAlreadyUsed() public {
        vm.startPrank(authorized);

        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IArtistRegistry.LensHandleAlreadyRegistered.selector,
                LENS_HANDLE_1
            )
        );
        registry.registerArtist(GENIUS_ARTIST_2, pkp2, LENS_HANDLE_1, lensAccount2);

        vm.stopPrank();
    }

    function test_RevertWhen_NotAuthorized() public {
        vm.startPrank(user1);

        vm.expectRevert(IArtistRegistry.NotAuthorized.selector);
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        vm.stopPrank();
    }

    // ============ Query Tests ============

    function test_GetArtist() public {
        vm.prank(authorized);
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        IArtistRegistry.Artist memory artist = registry.getArtist(GENIUS_ARTIST_1);

        assertEq(artist.geniusArtistId, GENIUS_ARTIST_1);
        assertEq(artist.pkpAddress, pkp1);
        assertEq(artist.lensHandle, LENS_HANDLE_1);
        assertEq(artist.lensAccountAddress, lensAccount1);
        assertFalse(artist.verified);
        assertGt(artist.createdAt, 0);
    }

    function test_RevertWhen_ArtistNotFound() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IArtistRegistry.ArtistNotFound.selector,
                GENIUS_ARTIST_1
            )
        );
        registry.getArtist(GENIUS_ARTIST_1);
    }

    function test_GetGeniusIdByPKP() public {
        vm.prank(authorized);
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        uint32 geniusId = registry.getGeniusIdByPKP(pkp1);
        assertEq(geniusId, GENIUS_ARTIST_1);
    }

    function test_GetGeniusIdByLensHandle() public {
        vm.prank(authorized);
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        uint32 geniusId = registry.getGeniusIdByLensHandle(LENS_HANDLE_1);
        assertEq(geniusId, GENIUS_ARTIST_1);
    }

    function test_GetLensHandle() public {
        vm.prank(authorized);
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        string memory handle = registry.getLensHandle(GENIUS_ARTIST_1);
        assertEq(handle, LENS_HANDLE_1);
    }

    function test_ArtistExists() public {
        assertFalse(registry.artistExists(GENIUS_ARTIST_1));

        vm.prank(authorized);
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        assertTrue(registry.artistExists(GENIUS_ARTIST_1));
    }

    function test_GetTotalArtists() public {
        assertEq(registry.getTotalArtists(), 0);

        vm.startPrank(authorized);
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);
        assertEq(registry.getTotalArtists(), 1);

        registry.registerArtist(GENIUS_ARTIST_2, pkp2, LENS_HANDLE_2, lensAccount2);
        assertEq(registry.getTotalArtists(), 2);
        vm.stopPrank();
    }

    // ============ Admin Tests ============

    function test_SetVerified() public {
        vm.prank(authorized);
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        IArtistRegistry.Artist memory artist = registry.getArtist(GENIUS_ARTIST_1);
        assertFalse(artist.verified);

        vm.prank(owner);
        registry.setVerified(GENIUS_ARTIST_1, true);

        artist = registry.getArtist(GENIUS_ARTIST_1);
        assertTrue(artist.verified);

        vm.prank(owner);
        registry.setVerified(GENIUS_ARTIST_1, false);

        artist = registry.getArtist(GENIUS_ARTIST_1);
        assertFalse(artist.verified);
    }

    function test_RevertWhen_SetVerified_NotOwner() public {
        vm.prank(authorized);
        registry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);

        vm.startPrank(user1);
        vm.expectRevert(IArtistRegistry.NotOwner.selector);
        registry.setVerified(GENIUS_ARTIST_1, true);
        vm.stopPrank();
    }

    function test_SetAuthorized() public {
        assertFalse(registry.isAuthorized(user1));

        vm.prank(owner);
        registry.setAuthorized(user1, true);

        assertTrue(registry.isAuthorized(user1));

        vm.prank(owner);
        registry.setAuthorized(user1, false);

        assertFalse(registry.isAuthorized(user1));
    }

    function test_RevertWhen_SetAuthorized_NotOwner() public {
        vm.startPrank(user1);
        vm.expectRevert(IArtistRegistry.NotOwner.selector);
        registry.setAuthorized(user2, true);
        vm.stopPrank();
    }

    function test_TransferOwnership() public {
        assertEq(registry.owner(), owner);

        vm.prank(owner);
        registry.transferOwnership(user1);

        assertEq(registry.owner(), user1);
        assertTrue(registry.isAuthorized(user1));
    }

    function test_RevertWhen_TransferOwnership_InvalidAddress() public {
        vm.startPrank(owner);
        vm.expectRevert(IArtistRegistry.InvalidPKPAddress.selector);
        registry.transferOwnership(address(0));
        vm.stopPrank();
    }

    function test_RevertWhen_TransferOwnership_NotOwner() public {
        vm.startPrank(user1);
        vm.expectRevert(IArtistRegistry.NotOwner.selector);
        registry.transferOwnership(user2);
        vm.stopPrank();
    }
}
