<script lang="ts">
	export let fixed: boolean = false;
</script>

<div class="pie-loading {fixed ? 'fixed' : ''}"></div>

<style>
    .pie-loading {
        position: absolute;
        height: 100%;
        width: 100%;
        background-color: #fff;
        bottom: 0;
        left: 0;
        right: 0;
        top: 0;
        z-index: 9999;
        opacity: 0.4;
    }

    .pie-loading.fixed {
        position: fixed;
    }

    .pie-loading:before {
        content: "";
        background-color: rgba(0, 0, 0, 0);
        border: 5px solid rgba(63, 81, 181, 0.9);
        opacity: 0.9;
        border-right: 5px solid rgba(0, 0, 0, 0);
        border-left: 5px solid rgba(0, 0, 0, 0);
        border-radius: 50px;
        box-shadow: 0 0 35px rgba(63, 81, 181, 0.9);
        width: 50px;
        height: 50px;
        animation: spinPulse 1s infinite linear;
        margin: -25px 0 0 -25px;
        position: absolute;
        top: 50%;
        left: 50%;
    }

    .pie-loading:after {
        content: "";
        background-color: rgba(0, 0, 0, 0);
        border: 5px solid rgba(63, 81, 181, 0.9);
        opacity: 0.9;
        border-left: 5px solid rgba(0, 0, 0, 0);
        border-right: 5px solid rgba(0, 0, 0, 0);
        border-radius: 50px;
        box-shadow: 0 0 15px rgba(63, 81, 181, 0.9);
        width: 30px;
        height: 30px;
        animation: spinoffPulse 1s infinite linear;
        margin: -15px 0 0 -15px;
        position: absolute;
        top: 50%;
        left: 50%;
    }

    @keyframes spinPulse {
        0% {
            transform: rotate(160deg);
            opacity: 0;
            box-shadow: 0 0 1px rgba(63, 81, 181, 0.9);
        }
        50% {
            transform: rotate(145deg);
            opacity: 1;
        }
        100% {
            transform: rotate(-320deg);
            opacity: 0;
        }
    }

    @keyframes spinoffPulse {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
