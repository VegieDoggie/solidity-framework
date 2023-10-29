// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Example} from "../contracts/Example.sol";

contract ExampleTest is Test {
    Example public example;

    function setUp() public {
        example = new Example();
        example.setNumber(0);
    }

    function test_setNumber() public {
        example.setNumber(1024);
        assertEq(example.getNumber(), 1024);
    }

    function testFuzz_SetNumber(uint256 x) public {
        example.setNumber(x);
        assertEq(example.getNumber(), x);
    }
}
